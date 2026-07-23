-- Send 50 emails per hour instead of per 30 minutes.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'send-due-emails') then
    perform cron.unschedule('send-due-emails');
  end if;
  perform cron.schedule(
    'send-due-emails',
    '0 * * * *',
    $job$
    select net.http_post(
      url := 'https://cjutymkbpcwnxbepnnty.functions.supabase.co/send-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $job$
  );
end
$do$;
