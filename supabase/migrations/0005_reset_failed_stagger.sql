-- Fresh start: failed and stuck sending rows back to queued with clean engagement fields.
update email_sends
set
  status = 'queued',
  error = null,
  sent_at = null,
  resend_id = null,
  opened_at = null,
  open_count = 0,
  clicked_at = null,
  click_count = 0
where status in ('failed', 'sending');

-- Wave scheduling: 50 emails per 30 minute window (only one wave is "due" until time advances).
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
