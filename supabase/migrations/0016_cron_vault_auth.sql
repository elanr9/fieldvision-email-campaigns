-- Cron auth via Vault. The app.service_role_key GUC cannot be set on this
-- project (ALTER DATABASE is not permitted), so the send-due cron now reads
-- the service role key from Vault. Store it once with:
--   select vault.create_secret('<service_role_key>', 'service_role_key', 'cron auth for send-due');
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
