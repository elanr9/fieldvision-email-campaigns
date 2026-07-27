export const FV_LOGO_URL =
  "https://cjutymkbpcwnxbepnnty.supabase.co/storage/v1/object/public/assets/fv-logo.png";

export type GpaTier = "high" | "mid" | "developing" | "unknown";

export type PersonalizeLead = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  club?: string | null;
  league?: string | null;
  grad_year?: number | null;
  gpa?: number | null;
  positions?: string | null;
  age_group?: string | null;
};

const SCHOOLS_BY_TIER: Record<GpaTier, string[]> = {
  high: [
    "Trinity University",
    "SMU",
    "TCU",
    "UT Dallas",
    "Colorado College",
    "St Edward's University",
    "Case Western Reserve",
    "Emory University",
    "Rhodes College",
    "Denison University",
  ],
  mid: [
    "UT Dallas",
    "Dallas Baptist",
    "Southwestern University",
    "Austin College",
    "St Mary's University",
    "Colorado School of Mines",
    "Hendrix College",
    "Centre College",
    "Berry College",
    "Sewanee",
  ],
  developing: [
    "Dallas Baptist",
    "UT Tyler",
    "Texas Lutheran",
    "Hardin Simmons",
    "Concordia Texas",
    "Schreiner University",
    "McMurry University",
    "LeTourneau University",
    "East Texas Baptist",
    "Howard Payne",
  ],
  unknown: [
    "Dallas Baptist",
    "UT Dallas",
    "St Edward's University",
    "Trinity University",
    "Southwestern University",
    "Texas Lutheran",
    "Austin College",
    "UT Tyler",
    "St Mary's University",
    "Hardin Simmons",
  ],
};

// Club names must never include age group, birth year, gender, or league
// suffixes (e.g. "Boston Bolts (U18/U19)" -> "Boston Bolts"), and only the first
// name of a club/school pair is used ("Blackrock FC / Northwood School").
export function cleanClubName(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\/.*$/, "")
    .replace(
      /\s+(ECNL|ECRL|ECML|MLS\s*Next|NPL|GA|DPL|Boys|Girls|[BG]\d{2,4}|\d{2}[BG]|U\d{1,2}|(?:19|20)\d{2}(?:\/\d{2,4})?|\d{2}\/\d{2}|\d{2})\b.*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// Some leads only have a showcase roster label ("Showcase - GREEN 1") instead of a
// real club, so the email references the showcase itself rather than the label.
export function isShowcaseClub(raw: string | null | undefined): boolean {
  return /\bshowcase\b/i.test(raw ?? "");
}

const CLUB_MENTION = /(?:at\s+a\s+showcase\s+)?(?:with|for|from|at)\s+\{\{\s*club\s*\}\}/gi;

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function gpaTier(gpa: number | null | undefined): GpaTier {
  if (gpa == null || Number.isNaN(gpa)) return "unknown";
  if (gpa >= 3.75) return "high";
  if (gpa >= 3.2) return "mid";
  return "developing";
}

export function schoolMatches(tier: GpaTier): string[] {
  return SCHOOLS_BY_TIER[tier];
}

export function gradYearAngle(gradYear: number | null | undefined): string {
  if (gradYear === 2026) {
    return "Since you are in the 2026 class getting in front of college programs now matters because coaches are still filling needs.";
  }
  if (gradYear === 2027) {
    return "Since you are in the 2027 class this is a good time to build a real college list before junior year gets crowded.";
  }
  if (gradYear === 2028) {
    return "Since you are in the 2028 class starting early helps you find programs that fit before outreach gets serious.";
  }
  if (gradYear != null && gradYear >= 2029) {
    return "Since you have time before college decisions this is a good window to learn which programs fit your soccer and academic profile.";
  }
  return "This is a good time to start narrowing down programs that fit your soccer and academic profile.";
}

export function defaultSubjectTemplate(): string {
  return "{{first_name}}, college soccer options for {{grad_year}}";
}

export function defaultBodyTemplate(): string {
  return [
    "Hi {{first_name}},",
    "",
    "I saw you play with {{club}} and wanted to reach out because your profile stood out.",
    "",
    "{{grad_year_angle}}",
    "",
    "{{gpa_line}}",
    "",
    "I put together a short list of ten schools that could be worth looking at:",
    "{{schools_list}}",
    "",
    "If you want I can send over a simple plan for how I would start outreach for a {{positions}} player in the {{grad_year}} class.",
    "",
    "Best,",
    "FieldVision",
  ].join("\n");
}

export const GRAD_YEAR_TEMPLATES: Record<number, { subject: string; body: string }> = {
  2026: {
    subject: "{{first_name}}, D1 programs are still finalizing rosters for fall 2026",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your film from {{club}} and wanted to reach out. With graduation coming up, are you still looking to play at the next level?",
      "",
      "If so, there's still time. D1 through D3 coaches are actively filling spots right now.",
      "",
      "Quick background on me: I grew up playing for Weston FC and now play D1 at Penn State. Going into my gap year I had zero college interest. By the end I had 10 offers. The only thing that changed was how I got in front of coaches.",
      "",
      "That's why my team and I built FieldVision AI. It does the entire recruiting grind for you, from highlight videos to coach outreach to follow-ups, in about 20 minutes a week. And since the window is closing, we made it free to try so there's no reason not to start today.",
    ].join("\n"),
  },
  2027: {
    subject: "{{first_name}}, it's not too late for college soccer!",
    body: [
      "Hey {{first_name}},",
      "",
      "I'm Elan, one of the co-founders at FieldVision. I saw you play for {{club}} and wanted to reach out about college soccer.",
      "",
      "Quick background on me: I played at Weston FC MLS Next, had 7 college offers(4 D1), and ended up playing at Brandeis University on a $70k/year scholarship.",
      "",
      "Most of 2027 recruiting is already over, I'm reaching out because I saw you play at a showcase we were at. I think D1's and top D2-D3's are still in the picture but you'd have to start ASAP and do it the right way (took me 10 hrs of work/week to get all my offers).",
      "",
      "To tell you a bit more about FieldVision: we cut those 10 hours/week down to just 20 min/week:",
      "- make your highlight videos in minutes with AI",
      "- personalized emails to AI suggested schools",
      "- follow ups, AI replies",
      "- guidance, research",
      "- everything for just $20/month",
      "",
      "We've helped over 1000 athletes in just 3 months and have seen better results than agencies that charge $5000+, most of our users got their first offer within 2 months and don't even play MLS Next/ECNL.",
      "",
      "We have a 1 week free-trial and I attached link below, doesn't hurt at all to try and best case we can get you into college soccer. If you're not interested no worries at all.",
    ].join("\n"),
  },
  2028: {
    subject: "{{first_name}}, the recruiting edge starts way earlier than you think",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your film from {{club}} and wanted to reach out. As a 2028 grad, you've got something most players waste: time.",
      "",
      "Here's what nobody tells younger players. The recruits who end up with real options aren't the ones who suddenly get good senior year. They're the ones coaches have been watching for two or three years already. The earlier you're on their radar, the more your name comes up when spots open.",
      "",
      "Quick background on me: I grew up playing for Weston FC and now play D1 at Penn State. Going into my gap year I had zero college interest. By the end I had 10 offers. The only thing that changed was how I got in front of coaches. I just wish I'd started sooner.",
      "",
      "That's why my team and I built FieldVision AI. It builds your recruiting profile and gets you in front of the right coaches, from highlight videos to outreach to follow-ups, in about 20 minutes a week. We made it free to try so you can see your profile come together before spending a single dollar.",
    ].join("\n"),
  },
};

export function templateForGradYear(year: number | null | undefined): { subject: string; body: string } | null {
  if (year && GRAD_YEAR_TEMPLATES[year]) return GRAD_YEAR_TEMPLATES[year];
  return null;
}

export function renderEmail(
  template: { subject: string; body: string },
  lead: PersonalizeLead
): { subject: string; body: string } {
  const tier = gpaTier(lead.gpa ?? null);
  const schools = schoolMatches(tier);
  const firstName =
    (lead.first_name && lead.first_name.trim()) ||
    splitName(lead.full_name || "").firstName ||
    "there";
  const lastName = lead.last_name || splitName(lead.full_name || "").lastName || "";
  const showcaseOnly = isShowcaseClub(lead.club);
  const club = showcaseOnly ? "a college showcase" : cleanClubName(lead.club ?? "") || "your club";
  const clubContext = showcaseOnly ? "what we saw at the showcase" : `${club} background`;
  const positions = (lead.positions && lead.positions.trim()) || "soccer";
  const gradYearStr = lead.grad_year ? String(lead.grad_year) : "your class";
  const angle = gradYearAngle(lead.grad_year ?? null);
  const topFive = schools.slice(0, 5).join(", ");
  const gpaLine =
    lead.gpa != null && !Number.isNaN(lead.gpa)
      ? `With your ${lead.gpa} GPA and ${clubContext} you could have a real conversation with programs like ${topFive}.`
      : `With your ${clubContext} you could start with programs like ${topFive} and then narrow the list by academics.`;
  const schoolsList = schools.map((school, i) => `${i + 1}. ${school}`).join("\n");

  const tokens: Record<string, string> = {
    first_name: firstName,
    last_name: lastName,
    full_name: (lead.full_name && lead.full_name.trim()) || `${firstName} ${lastName}`.trim(),
    email: lead.email || "",
    club,
    league: lead.league || "",
    grad_year: gradYearStr,
    grad_year_angle: angle,
    gpa: lead.gpa != null ? String(lead.gpa) : "",
    gpa_line: gpaLine,
    schools_list: schoolsList,
    positions,
    age_group: lead.age_group || "",
  };

  const apply = (text: string): string => {
    const phrased = showcaseOnly ? text.replace(CLUB_MENTION, "at a college showcase") : text;
    return phrased.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) =>
      key in tokens ? tokens[key] : ""
    );
  };

  return {
    subject: apply(template.subject),
    body: apply(template.body),
  };
}
