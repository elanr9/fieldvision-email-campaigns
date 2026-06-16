-- Auto-send: one click starts the campaign, then 50 emails go out every 30 minutes.

-- Reschedule all queued sends into 30 minute waves of 50 (first wave due now).
with ordered as (
  select id,
    row_number() over (order by scheduled_at asc, id asc) as rn
  from email_sends
  where status = 'queued'
)
update email_sends es
set scheduled_at = now() + ((floor((o.rn - 1) / 50)::int) * interval '30 minutes')
from ordered o
where es.id = o.id;

-- Re-enable the cron that calls send-due automatically every 30 minutes.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'send-due-emails') then
    perform cron.unschedule('send-due-emails');
  end if;
  perform cron.schedule(
    'send-due-emails',
    '*/30 * * * *',
    $job$
    select net.http_post(
      url := 'https://cjutymkbpcwnxbepnnty.functions.supabase.co/send-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );
end
$do$;
