import Papa from "papaparse";

export type CsvRow = {
  full_name: string;
  email: string;
  phone_number: string;
  account_type: string;
  profile_type: string;
  age_group: string;
  positions: string;
  current_team: string;
  league: string;
  graduation_year: string;
  gpa: string;
  weighted_gpa: string;
  survey_completed: string;
  free_trial_used: string;
  conversion_status: string;
  signup_date: string;
};

const FIELDS: (keyof CsvRow)[] = [
  "full_name",
  "email",
  "phone_number",
  "account_type",
  "profile_type",
  "age_group",
  "positions",
  "current_team",
  "league",
  "graduation_year",
  "gpa",
  "weighted_gpa",
  "survey_completed",
  "free_trial_used",
  "conversion_status",
  "signup_date",
];

export function parseCsv(text: string): CsvRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });

  return (result.data || [])
    .map((raw) => {
      const row = {} as CsvRow;
      for (const field of FIELDS) {
        row[field] = (raw[field] ?? "").toString().trim();
      }
      row.email = row.email.toLowerCase();
      return row;
    })
    .filter((row) => row.email && row.email.includes("@"));
}
