export type GpaTier = "high" | "mid" | "developing" | "unknown";

export type Lead = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  club?: string | null;
  league?: string | null;
  grad_year?: number | null;
  gpa?: number | null;
  positions?: string | null;
  age_group?: string | null;
};

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function gpaTier(gpa: number | null | undefined): GpaTier {
  if (gpa === null || gpa === undefined || Number.isNaN(gpa)) return "unknown";
  if (gpa >= 3.75) return "high";
  if (gpa >= 3.2) return "mid";
  return "developing";
}

const schoolLists: Record<GpaTier, string[]> = {
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

export function schoolMatches(tier: GpaTier): string[] {
  return schoolLists[tier];
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
  if (typeof gradYear === "number" && gradYear >= 2029) {
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

export function renderEmail(
  template: { subject: string; body: string },
  lead: Lead,
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
  const gpaLine = lead.gpa
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
    gpa: lead.gpa !== null && lead.gpa !== undefined ? String(lead.gpa) : "",
    gpa_line: gpaLine,
    schools_list: schoolsList,
    positions,
    age_group: lead.age_group || "",
  };

  const apply = (text: string): string =>
    text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_match, key: string) =>
      key in tokens ? tokens[key] : "",
    );

  return {
    subject: apply(template.subject),
    body: apply(template.body),
  };
}
