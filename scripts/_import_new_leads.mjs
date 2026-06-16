import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

function toNum(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value === "string" ? value.trim() : value;
  if (t === "" || t === "N/A" || t === "n/a") return null;
  const n = typeof t === "number" ? t : Number(t);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === "N/A" || s === "n/a") return null;
  return s;
}

function gradYear(value) {
  const s = String(value ?? "").trim();
  return /^\d{4}$/.test(s) ? Number(s) : null;
}

const text = readFileSync("new-soccer-leads.csv", "utf8");
const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
  transform: (v) => (typeof v === "string" ? v.trim() : v),
});

const totalRows = parsed.data.length;
let invalidEmail = 0;
let dupInCsv = 0;
const seen = new Set();
const records = [];

for (const raw of parsed.data) {
  const email = String(raw["Email"] ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    invalidEmail++;
    continue;
  }
  if (seen.has(email)) {
    dupInCsv++;
    continue;
  }
  seen.add(email);

  const firstName = strOrNull(raw["First Name"]);
  const lastName = strOrNull(raw["Last Name"]);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  records.push({
    full_name: fullName || email,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: strOrNull(raw["Phone"]),
    club: strOrNull(raw["Team"]),
    league: null,
    grad_year: gradYear(raw["Grad Year"]),
    gpa: toNum(raw["GPA"]),
    weighted_gpa: null,
    positions: strOrNull(raw["Position"]),
    age_group: null,
    raw,
  });
}

async function existingEmails() {
  const set = new Set();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("leads")
      .select("email")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const r of data) set.add(String(r.email).toLowerCase());
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set;
}

const existing = await existingEmails();
const toInsert = records.filter((r) => !existing.has(r.email));
const dupInDb = records.length - toInsert.length;

let inserted = 0;
const chunkSize = 500;
for (let i = 0; i < toInsert.length; i += chunkSize) {
  const chunk = toInsert.slice(i, i + chunkSize);
  const { error, count } = await supabase
    .from("leads")
    .insert(chunk, { count: "exact" });
  if (error) {
    console.error("Insert error:", error.message);
    process.exit(1);
  }
  inserted += count ?? chunk.length;
}

const byYear = {};
for (const r of toInsert) {
  const k = r.grad_year === null ? "null" : String(r.grad_year);
  byYear[k] = (byYear[k] || 0) + 1;
}

console.log(JSON.stringify({
  totalRows,
  invalidEmail,
  dupInCsv,
  dupInDb,
  uniqueValidCsv: records.length,
  inserted,
  byYear,
}, null, 2));
