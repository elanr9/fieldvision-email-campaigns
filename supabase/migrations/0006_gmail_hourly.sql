-- claim_due_sends: respect campaign status (active only)
drop function if exists claim_due_sends(int);
create or replace function claim_due_sends(limit_count int)
returns table (
  id uuid, campaign_id uuid, lead_id uuid, subject text, body text,
  scheduled_at timestamptz, email text, full_name text, first_name text
)
language sql security definer set search_path = public
as $$
  with picked as (
    select es.id
    from email_sends es
    join campaigns c on c.id = es.campaign_id
    where es.status = 'queued'
      and es.scheduled_at <= now()
      and c.status = 'active'
    order by es.scheduled_at asc
    limit limit_count
    for update skip locked
  ),
  claimed as (
    update email_sends
    set status = 'sending'
    where id in (select id from picked)
    returning id, campaign_id, lead_id, subject, body, scheduled_at
  )
  select c.id, c.campaign_id, c.lead_id, c.subject, c.body, c.scheduled_at,
    l.email, l.full_name, l.first_name
  from claimed c
  join leads l on l.id = c.lead_id;
$$;
grant execute on function claim_due_sends(int) to service_role;

-- Bulk update send subject/body for template editing
create or replace function bulk_update_send_content(updates jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  r jsonb;
  cnt int := 0;
begin
  for r in select * from jsonb_array_elements(updates)
  loop
    update email_sends
    set subject = (r->>'subject'),
        body    = (r->>'body')
    where id     = (r->>'id')::uuid
      and status = 'queued';
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
grant execute on function bulk_update_send_content(jsonb) to service_role;

-- Get campaign template for the edit modal
create or replace function get_campaign_template(campaign_uuid uuid)
returns table(id uuid, name text, subject_template text, body_template text, status text)
language sql security definer set search_path = public
as $$
  select id, name, subject_template, body_template, status
  from campaigns
  where id = campaign_uuid;
$$;
grant execute on function get_campaign_template(uuid) to anon, authenticated, service_role;

-- Set campaign status (pause / resume / complete)
create or replace function set_campaign_status(campaign_uuid uuid, new_status text)
returns void
language sql security definer set search_path = public
as $$
  update campaigns
  set status = new_status
  where id = campaign_uuid
    and new_status in ('active', 'paused', 'complete');
$$;
grant execute on function set_campaign_status(uuid, text) to anon, authenticated, service_role;

-- Pause 2027 and 2028 campaigns so we start with 2026 only
update campaigns set status = 'paused' where number in (2, 3);

-- Reschedule 2026 (campaign #1) queued sends into hourly waves of 50
-- First wave is due now so clicking "Send next 50" works immediately
with ordered as (
  select es.id,
    row_number() over (order by es.id asc) as rn
  from email_sends es
  join campaigns c on c.id = es.campaign_id
  where es.status = 'queued'
    and c.number = 1
)
update email_sends es
set scheduled_at = now() + ((floor((o.rn - 1) / 50)::int) * interval '60 minutes')
from ordered o
where es.id = o.id;
