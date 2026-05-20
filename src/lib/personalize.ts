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
    subject: "{{first_name}}, it's not too late for College Soccer",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your profile playing for {{club}} and wanted to reach out personally.",
      "",
      "I grew up playing for Weston FC and Dallas Texans, got 4 D1 offers including Michigan State, and went to Brandeis in Boston. My parents couldn't afford NCSA so I did everything myself — 10+ hours a week of cold emails and film editing. That's exactly why I built FieldVision.",
      "",
      "D1, D2, and D3 programs are still finalizing their last spots for next fall and we think you have a real shot at a college soccer scholarship before this window closes.",
      "",
      "Here's what FieldVision does for you:",
      "- Upload your clips and AI builds your highlight video",
      "- We email 50 coaches a day on your behalf and automatically follow up with anyone who doesn't respond",
      "- Get notified the moment a coach opens your email or watches your video",
      "- Guided by 30+ D1 athletes at programs like Michigan State, UNC, and UCLA",
      "",
      "You focus on your game. We handle everything else.",
    ].join("\n"),
  },
  2027: {
    subject: "{{first_name}}, junior year is when coaches lock in commits",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your profile playing for {{club}} and wanted to reach out personally.",
      "",
      "You're in the 2027 class, which means junior year is right around the corner. That's when college coaches make most of their decisions, and the players who show up on their radar early are the ones who get recruited.",
      "",
      "FieldVision is the platform I built to handle recruiting for players like you. We email 50 college coaches a day on your behalf, build your highlight video in minutes, and alert you when coaches open your profile.",
      "",
      "You focus on your game. We handle the recruiting.",
    ].join("\n"),
  },
  2028: {
    subject: "{{first_name}}, the players getting recruited early start now",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your profile playing for {{club}} and wanted to reach out directly.",
      "",
      "You're in the 2028 class, and the players who end up with D1 offers are the ones coaches have been tracking since sophomore year. That window is open right now.",
      "",
      "FieldVision is the platform I built to get players like you in front of college coaches early. We email 50 coaches a day on your behalf, build your highlight video in minutes, and alert you when coaches open your profile.",
      "",
      "Starting now puts you years ahead of players who wait until junior year.",
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
  const club = (lead.club && lead.club.trim()) || "your club";
  const positions = (lead.positions && lead.positions.trim()) || "soccer";
  const gradYearStr = lead.grad_year ? String(lead.grad_year) : "your class";
  const angle = gradYearAngle(lead.grad_year ?? null);
  const topFive = schools.slice(0, 5).join(", ");
  const gpaLine =
    lead.gpa != null && !Number.isNaN(lead.gpa)
      ? `With your ${lead.gpa} GPA and ${club} background you could have a real conversation with programs like ${topFive}.`
      : `With your ${club} background you could start with programs like ${topFive} and then narrow the list by academics.`;
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

  const apply = (text: string): string =>
    text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) =>
      key in tokens ? tokens[key] : ""
    );

  return {
    subject: apply(template.subject),
    body: apply(template.body),
  };
}
