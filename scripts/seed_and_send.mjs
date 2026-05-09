import fs from "node:fs";
import Papa from "papaparse";

const SUPABASE_URL = "https://cjutymkbpcwnxbepnnty.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdXR5bWticGN3bnhiZXBubnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTk0MzIsImV4cCI6MjA5MzgzNTQzMn0.gf1PpbKMEz7EHzvQrMQzanSoDzc0OHa3DUdz50yF_CY";
const HEADERS = {
  "apikey": ANON,
  "Authorization": `Bearer ${ANON}`,
  "Content-Type": "application/json",
};

const TEMPLATES = {
  2026: {
    subject: "{{first_name}}, it's not too late for College Soccer!",
    body: [
      "Hi {{first_name}}!",
      "",
      "I'm Elan, the CEO of FieldVision AI: the First-Ever AI College Recruitment Platform.",
      "",
      "I saw you play for {{club}} and are graduating soon. Not sure what your college plans are but FieldVision's here to save you!",
      "",
      "FieldVision can get you a college offer in less than a month. Here's how it works:",
      "Emails 50 Coaches/day for you with automatic follow-ups",
      "Professional AI Highlight Videos in 5 minutes, just upload your clips!",
      "Notified when coaches open your HL Video/Email",
      "Guided by current D1 players",
      "",
      "I think it's too late doing it yourself, but with FieldVision and your potential we can save your future college soccer career.",
      "",
      "Get started free: https://fieldvisionai.com",
      "",
      "Elan",
      "CEO & Co-founder",
      "FieldVision",
    ].join("\n"),
  },
  2027: {
    subject: "{{first_name}}, this is YOUR year for College Soccer recruiting",
    body: [
      "Hi {{first_name}}!",
      "",
      "I'm Elan, the CEO of FieldVision AI: the First-Ever AI College Recruitment Platform.",
      "",
      "I saw you play for {{club}}. You're in the 2027 class which means junior year is right around the corner and that's when coaches lock in their commits.",
      "",
      "FieldVision puts you on coaches' radars in less than a month. Here's how it works:",
      "Emails 50 Coaches/day for you with automatic follow-ups",
      "Professional AI Highlight Videos in 5 minutes, just upload your clips!",
      "Notified when coaches open your HL Video/Email",
      "Guided by current D1 players",
      "",
      "Doing this on your own is a full time job. With FieldVision you focus on your game and we handle the recruiting.",
      "",
      "Get started free: https://fieldvisionai.com",
      "",
      "Elan",
      "CEO & Co-founder",
      "FieldVision",
    ].join("\n"),
  },
  2028: {
    subject: "{{first_name}}, get ahead in College Soccer recruiting",
    body: [
      "Hi {{first_name}}!",
      "",
      "I'm Elan, the CEO of FieldVision AI: the First-Ever AI College Recruitment Platform.",
      "",
      "I saw you play for {{club}}. You're in the 2028 class and the players who lock in offers early are the ones who start outreach sophomore year. Coaches are tracking 2028s right now.",
      "",
      "FieldVision gets you on coaches' radars in less than a month. Here's how it works:",
      "Emails 50 Coaches/day for you with automatic follow-ups",
      "Professional AI Highlight Videos in 5 minutes, just upload your clips!",
      "Notified when coaches open your HL Video/Email",
      "Guided by current D1 players",
      "",
      "Starting now puts you years ahead of players who wait until junior year.",
      "",
      "Get started free: https://fieldvisionai.com",
      "",
      "Elan",
      "CEO & Co-founder",
      "FieldVision",
    ].join("\n"),
  },
};

function clean(value) {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s || s === "N/A" || s === "n/a") return "";
  return s;
}

function transformCsv(path) {
  const text = fs.readFileSync(path, "utf8");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows = [];
  for (const r of parsed.data) {
    const email = clean(r.Email).toLowerCase();
    if (!email.includes("@")) continue;
    const first = clean(r["First Name"]);
    const last = clean(r["Last Name"]);
    rows.push({
      full_name: [first, last].filter(Boolean).join(" "),
      email,
      phone_number: clean(r.Phone),
      age_group: "",
      positions: clean(r.Position),
      current_team: clean(r.Team),
      league: "",
      graduation_year: clean(r["Grad Year"]),
      gpa: clean(r.GPA),
      weighted_gpa: "",
    });
  }
  return rows;
}

async function importLeads(rows) {
  console.log(`Importing ${rows.length} leads...`);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-csv`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ rows }),
  });
  const json = await res.json();
  console.log("Import:", json);
  if (!res.ok) throw new Error("Import failed");
  return json;
}

async function createCampaign(year) {
  const tpl = TEMPLATES[year];
  const payload = {
    name: `Class of ${year} Wave 1`,
    subject_template: tpl.subject,
    body_template: tpl.body,
    lead_filter: { grad_years: [year] },
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-campaign`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  console.log(`Campaign ${year}:`, json);
  if (!res.ok) throw new Error(`Create campaign ${year} failed`);
  return json;
}

async function flushQueue(maxLoops = 30) {
  let totalSent = 0;
  let totalFailed = 0;
  for (let i = 0; i < maxLoops; i++) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-due`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({}),
    });
    const json = await res.json();
    console.log(`send-due loop ${i + 1}:`, json);
    if (!res.ok) {
      console.error("send-due failed", json);
      break;
    }
    totalSent += json.sent || 0;
    totalFailed += json.failed || 0;
    if ((json.processed || 0) === 0) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { totalSent, totalFailed };
}

async function main() {
  const csv = "data/soccer_leads (1).csv";
  const rows = transformCsv(csv);
  await importLeads(rows);
  for (const year of [2026, 2027, 2028]) {
    await createCampaign(year);
  }
  const result = await flushQueue();
  console.log("DONE:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
