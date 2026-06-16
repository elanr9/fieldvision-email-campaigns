-- campaign_target_leads: returns the leads a new campaign should target.
-- When exclude_contacted is true, leads that already have any email_send row
-- (queued or sent in a prior campaign) are skipped so they are not emailed again.
create or replace function campaign_target_leads(
  grad_years int[] default null,
  exclude_contacted boolean default false
)
returns table (
  id uuid,
  full_name text,
  first_name text,
  last_name text,
  email text,
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
    l.id,
    l.full_name,
    l.first_name,
    l.last_name,
    l.email,
    l.club,
    l.league,
    l.grad_year,
    l.gpa,
    l.positions,
    l.age_group
  from leads l
  where (grad_years is null or l.grad_year = any (grad_years))
    and (
      not exclude_contacted
      or not exists (select 1 from email_sends es where es.lead_id = l.id)
    );
$$;
grant execute on function campaign_target_leads(int[], boolean) to service_role;
