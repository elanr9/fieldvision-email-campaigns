-- Showcase roster labels ("Showcase - GREEN 1") are not real club names, so queued
-- copy should reference a college showcase instead of the label.
update email_sends es
set subject = replace(es.subject, l.club, 'a college showcase'),
    body = replace(
      replace(
        replace(es.body, 'at a showcase with ' || l.club, 'at a college showcase'),
        'play for ' || l.club, 'play at a college showcase'),
      l.club, 'a college showcase')
from leads l
where es.lead_id = l.id
  and es.status = 'queued'
  and l.club ~* '\mshowcase\M';

-- Club/school pairs ("Blackrock FC / Northwood School") read like scraped data,
-- so keep only the first name.
with cleaned as (
  select id, club, btrim(split_part(club, '/', 1)) as clean_club
  from leads
  where club like '%/%'
)
update email_sends es
set subject = replace(es.subject, c.club, c.clean_club),
    body = replace(es.body, c.club, c.clean_club)
from cleaned c
where es.lead_id = c.id
  and es.status = 'queued'
  and c.clean_club <> '';

update leads
set club = btrim(split_part(club, '/', 1))
where club like '%/%'
  and btrim(split_part(club, '/', 1)) <> '';
