-- Strip old CTA link + signature block from queued sends
-- The old bodies end with: "\n\nGet started free: https://fieldvisionai.com\n\nElan\nCEO & Co-founder\nFieldVision"
-- We remove it so the new HTML builder adds the button + signature cleanly

update email_sends
set body = trim(
  regexp_replace(
    body,
    E'\n\nGet started free: https://fieldvisionai\\.com\n\nElan\nCEO & Co-founder\nFieldVision',
    '',
    'g'
  )
)
where status = 'queued';

-- Update campaign 1 (Class of 2026) template to the new clean version
update campaigns
set
  subject_template = '{{first_name}}, it''s not too late for College Soccer',
  body_template = E'Hi {{first_name}},\n\nI personally came across your profile playing for {{club}} and had to reach out.\n\nThe Class of 2026 window is still open. D1, D2, and D3 programs are actively filling their last spots for next fall and most players don''t realize how fast this closes.\n\nFieldVision is the recruiting platform I built to help players like you get in front of coaches fast. We email 50 college coaches a day on your behalf, build your highlight video in minutes, and alert you the moment a coach opens your profile.\n\nMost players we work with get their first coach response within 2 weeks.'
where number = 1;

-- Update campaign 2 (Class of 2027) template
update campaigns
set
  subject_template = '{{first_name}}, junior year is when coaches lock in commits',
  body_template = E'Hi {{first_name}},\n\nI came across your profile playing for {{club}} and wanted to reach out personally.\n\nYou''re in the 2027 class, which means junior year is right around the corner. That''s when college coaches make most of their decisions, and the players who show up on their radar early are the ones who get recruited.\n\nFieldVision is the platform I built to handle recruiting for players like you. We email 50 college coaches a day on your behalf, build your highlight video in minutes, and alert you when coaches open your profile.\n\nYou focus on your game. We handle the recruiting.'
where number = 2;

-- Update campaign 3 (Class of 2028) template
update campaigns
set
  subject_template = '{{first_name}}, the players getting recruited early start now',
  body_template = E'Hi {{first_name}},\n\nI came across your profile playing for {{club}} and wanted to reach out directly.\n\nYou''re in the 2028 class, and the players who end up with D1 offers are the ones coaches have been tracking since sophomore year. That window is open right now.\n\nFieldVision is the platform I built to get players like you in front of college coaches early. We email 50 coaches a day on your behalf, build your highlight video in minutes, and alert you when coaches open your profile.\n\nStarting now puts you years ahead of players who wait until junior year.'
where number = 3;
