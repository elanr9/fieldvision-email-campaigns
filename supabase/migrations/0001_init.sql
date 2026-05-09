-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Auto incrementing campaign number
create sequence if not exists campaigns_number_seq start 1;

create or replace function next_campaign_number()
returns int
language sql
security definer
set search_path = public
as $$
  select nextval('campaigns_number_seq')::int;
$$;
grant execute on function next_campaign_number() to anon, authenticated, service_role;

-- campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  number int unique not null,
  name text not null,
  subject_template text not null,
  body_template text not null,
  status text not null default 'active' check (status in ('active','paused','complete')),
  created_at timestamptz not null default now()
);

-- leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  first_name text,
  last_name text,
  email text not null unique,
  phone text,
  club text,
  league text,
  grad_year int,
  gpa numeric,
  weighted_gpa numeric,
  positions text,
  age_group text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists leads_email_idx on leads (email);
create index if not exists leads_grad_year_idx on leads (grad_year);

-- email_sends
create table if not exists email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int not null default 0,
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);
create index if not exists email_sends_due_idx on email_sends (status, scheduled_at);
create index if not exists email_sends_campaign_idx on email_sends (campaign_id);

-- RLS on with no permissive policies. Service role bypasses RLS.
-- The frontend uses anon key only to invoke edge functions.
alter table campaigns enable row level security;
alter table leads enable row level security;
alter table email_sends enable row level security;

-- dashboard_overview: one row per campaign with aggregate stats
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
  open_rate numeric
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
    case
      when count(es.id) filter (where es.status = 'sent') > 0
        then count(es.id) filter (where es.opened_at is not null)::numeric
             / count(es.id) filter (where es.status = 'sent')
      else 0
    end as open_rate
  from campaigns c
  left join email_sends es on es.campaign_id = c.id
  group by c.id
  order by c.number desc;
$$;
grant execute on function dashboard_overview() to anon, authenticated, service_role;

-- campaign_detail: one row per email_send for a given campaign
create or replace function campaign_detail(campaign_uuid uuid)
returns table (
  send_id uuid,
  status text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int,
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

-- claim_due_sends: atomically claim N due rows by setting status='sending' and return them.
-- Uses FOR UPDATE SKIP LOCKED so concurrent invocations do not double send.
create or replace function claim_due_sends(limit_count int)
returns table (
  id uuid,
  campaign_id uuid,
  lead_id uuid,
  subject text,
  body text,
  scheduled_at timestamptz,
  email text,
  full_name text,
  first_name text
)
language sql
security definer
set search_path = public
as $$
  with picked as (
    select es.id
    from email_sends es
    where es.status = 'queued'
      and es.scheduled_at <= now()
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
  select
    c.id,
    c.campaign_id,
    c.lead_id,
    c.subject,
    c.body,
    c.scheduled_at,
    l.email,
    l.full_name,
    l.first_name
  from claimed c
  join leads l on l.id = c.lead_id;
$$;
grant execute on function claim_due_sends(int) to service_role;

-- track_email_open: bumps open_count and stamps opened_at the first time
create or replace function track_email_open(send_uuid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update email_sends
  set opened_at = coalesce(opened_at, now()),
      open_count = open_count + 1
  where id = send_uuid;
$$;
grant execute on function track_email_open(uuid) to anon, authenticated, service_role;

-- Cron: invoke send-due edge function every minute.
-- Setup steps for the operator:
--   1. Replace PROJECT_REF below with your Supabase project ref.
--   2. Store the service role key once via:
--        select set_config('app.service_role_key', '<service_role_key>', false);
--      For persistence across sessions use ALTER DATABASE postgres SET app.service_role_key = '...';
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'send-due-emails') then
    perform cron.schedule(
      'send-due-emails',
      '* * * * *',
      $job$
      select net.http_post(
        url := 'https://PROJECT_REF.functions.supabase.co/send-due',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$
    );
  end if;
end
$do$;

-- Sanity check insert (uncomment locally to seed one campaign):
-- insert into campaigns (number, name, subject_template, body_template)
-- values (next_campaign_number(), 'Bootstrap', 'Hi {{first_name}}', 'Hi {{first_name}} from FieldVision');
