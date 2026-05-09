-- Click tracking columns
alter table email_sends
  add column if not exists clicked_at timestamptz,
  add column if not exists click_count int not null default 0;

-- Record a click
create or replace function track_email_click(send_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update email_sends
  set clicked_at = coalesce(clicked_at, now()),
      click_count = click_count + 1
  where id = send_uuid;
$$;
grant execute on function track_email_click(uuid) to anon, authenticated, service_role;

-- Dashboard with clicked counts
drop function if exists dashboard_overview();
create or replace function dashboard_overview()
returns table (
  id uuid,
  number int,
  name text,
  status text,
  created_at timestamptz,
  total_sends bigint,
  sent_count bigint,
  opened_count bigint,
  clicked_count bigint,
  failed_count bigint,
  open_rate numeric,
  click_rate numeric
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.number,
    c.name,
    c.status,
    c.created_at,
    coalesce(count(es.id), 0)::bigint as total_sends,
    coalesce(count(es.id) filter (where es.status = 'sent'), 0)::bigint as sent_count,
    coalesce(count(es.id) filter (where es.opened_at is not null), 0)::bigint as opened_count,
    coalesce(count(es.id) filter (where es.clicked_at is not null), 0)::bigint as clicked_count,
    coalesce(count(es.id) filter (where es.status = 'failed'), 0)::bigint as failed_count,
    case
      when count(es.id) filter (where es.status = 'sent') > 0
        then count(es.id) filter (where es.opened_at is not null)::numeric
             / count(es.id) filter (where es.status = 'sent')
      else 0
    end as open_rate,
    case
      when count(es.id) filter (where es.status = 'sent') > 0
        then count(es.id) filter (where es.clicked_at is not null)::numeric
             / count(es.id) filter (where es.status = 'sent')
      else 0
    end as click_rate
  from campaigns c
  left join email_sends es on es.campaign_id = c.id
  group by c.id
  order by c.number desc;
$$;
grant execute on function dashboard_overview() to anon, authenticated, service_role;

-- Campaign detail with clicked columns
drop function if exists campaign_detail(uuid);
create or replace function campaign_detail(campaign_uuid uuid)
returns table (
  send_id uuid,
  status text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int,
  clicked_at timestamptz,
  click_count int,
  subject text,
  body text,
  lead_id uuid,
  full_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  club text,
  league text,
  grad_year int,
  gpa numeric,
  positions text,
  age_group text
)
language sql
security definer
set search_path = public
as $$
  select
    es.id as send_id,
    es.status,
    es.scheduled_at,
    es.sent_at,
    es.opened_at,
    es.open_count,
    es.clicked_at,
    es.click_count,
    es.subject,
    es.body,
    l.id as lead_id,
    l.full_name,
    l.first_name,
    l.last_name,
    l.email,
    l.phone,
    l.club,
    l.league,
    l.grad_year,
    l.gpa,
    l.positions,
    l.age_group
  from email_sends es
  join leads l on l.id = es.lead_id
  where es.campaign_id = campaign_uuid
  order by es.scheduled_at asc;
$$;
grant execute on function campaign_detail(uuid) to anon, authenticated, service_role;
