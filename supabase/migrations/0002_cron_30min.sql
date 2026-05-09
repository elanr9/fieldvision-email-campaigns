-- Update send-due cron to every 30 minutes
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
