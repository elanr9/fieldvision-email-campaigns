-- Club names must never include age group, birth year, gender, or league
-- suffixes (e.g. "Boston Bolts (U18/U19)" -> "Boston Bolts").
-- Fix queued email bodies first (they were rendered from the raw club),
-- then clean the club column itself.

with cleaned as (
  select id, club,
    nullif(btrim(regexp_replace(regexp_replace(regexp_replace(club,
      '\s*\([^)]*\)\s*', ' ', 'g'),
      '\s+(ECNL|ECRL|ECML|MLS\s*Next|NPL|GA|DPL|Boys|Girls|[BG]\d{2,4}|\d{2}[BG]|U\d{1,2}|(19|20)\d{2}(/\d{2,4})?|\d{2}/\d{2}|\d{2})\M.*$', '', 'i'),
      '\s+', ' ', 'g')), '') as clean_club
  from leads
  where club is not null
)
update email_sends es
set subject = replace(es.subject, c.club, c.clean_club),
    body = replace(es.body, c.club, c.clean_club)
from cleaned c
where es.lead_id = c.id
  and es.status = 'queued'
  and c.clean_club is not null
  and c.clean_club <> c.club;

update leads
set club = nullif(btrim(regexp_replace(regexp_replace(regexp_replace(club,
  '\s*\([^)]*\)\s*', ' ', 'g'),
  '\s+(ECNL|ECRL|ECML|MLS\s*Next|NPL|GA|DPL|Boys|Girls|[BG]\d{2,4}|\d{2}[BG]|U\d{1,2}|(19|20)\d{2}(/\d{2,4})?|\d{2}/\d{2}|\d{2})\M.*$', '', 'i'),
  '\s+', ' ', 'g')), '')
where club is not null;
