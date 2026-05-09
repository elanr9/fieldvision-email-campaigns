-- Disable auto send cron. Sends only happen when you click the button.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'send-due-emails') then
    perform cron.unschedule('send-due-emails');
  end if;
end
$do$;
