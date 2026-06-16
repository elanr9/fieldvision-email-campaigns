import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Template copy: GRAD_YEAR_TEMPLATES from src/lib/personalize.ts (2027 / 2028)
const TEMPLATES = {
  2027: {
    subject: "{{first_name}}, the players who commit early start now",
    body: [
      "Hi {{first_name}},",
      "",
      "I came across your film from {{club}} and wanted to reach out. As a 2027 grad, you're right at the point where getting on coaches' radars early makes the biggest difference.",
      "",
      "Here's what most players don't realize: the recruits who land the best offers usually start the process a full year before their classmates. Coaches build their boards early, and the players already in front of them have the edge.",
      "",
      "Quick background on me: I grew up playing for Weston FC and now play D1 at Penn State. Going into my gap year I had zero college interest. By the end I had 10 offers. The only thing that changed was how I got in front of coaches.",
      "",
      "That's why my team and I built FieldVision AI. It does the entire recruiting grind for you, from highlight videos to coach outreach to follow-ups, in about 20 minutes a week. We offer a free trial so you can see exactly which coaches you could be reaching before committing to anything.",
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

const CAMPAIGNS = [
  { id: "e7330d56-4962-4451-8df2-116297cd9a58", number: 2, gradYear: 2027 },
  { id: "b23a9c21-c368-4ac0-b839-2ac154e3f403", number: 3, gradYear: 2028 },
];

// --- renderEmail replicated EXACTLY from supabase/functions/_shared/personalize.ts ---
const SCHOOLS_BY_TIER = {
  high: ["Trinity University","SMU","TCU","UT Dallas","Colorado College","St Edward's University","Case Western Reserve","Emory University","Rhodes College","Denison University"],
  mid: ["UT Dallas","Dallas Baptist","Southwestern University","Austin College","St Mary's University","Colorado School of Mines","Hendrix College","Centre College","Berry College","Sewanee"],
  developing: ["Dallas Baptist","UT Tyler","Texas Lutheran","Hardin Simmons","Concordia Texas","Schreiner University","McMurry University","LeTourneau University","East Texas Baptist","Howard Payne"],
  unknown: ["Dallas Baptist","UT Dallas","St Edward's University","Trinity University","Southwestern University","Texas Lutheran","Austin College","UT Tyler","St Mary's University","Hardin Simmons"],
};

function splitName(fullName) {
  const trimmed = (fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
function gpaTier(gpa) {
  if (gpa === null || gpa === undefined || Number.isNaN(gpa)) return "unknown";
  if (gpa >= 3.75) return "high";
  if (gpa >= 3.2) return "mid";
  return "developing";
}
function gradYearAngle(gradYear) {
  if (gradYear === 2026) return "Since you are in the 2026 class getting in front of college programs now matters because coaches are still filling needs.";
  if (gradYear === 2027) return "Since you are in the 2027 class this is a good time to build a real college list before junior year gets crowded.";
  if (gradYear === 2028) return "Since you are in the 2028 class starting early helps you find programs that fit before outreach gets serious.";
  if (typeof gradYear === "number" && gradYear >= 2029) return "Since you have time before college decisions this is a good window to learn which programs fit your soccer and academic profile.";
  return "This is a good time to start narrowing down programs that fit your soccer and academic profile.";
}
function renderEmail(template, lead) {
  const tier = gpaTier(lead.gpa ?? null);
  const schools = SCHOOLS_BY_TIER[tier];
  const firstName = (lead.first_name && lead.first_name.trim()) || splitName(lead.full_name || "").firstName || "there";
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
  const tokens = {
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
  const apply = (text) => text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key) => (key in tokens ? tokens[key] : ""));
  return { subject: apply(template.subject), body: apply(template.body) };
}
// --- end replicated logic ---

async function fetchAll(table, columns, applyFilters) {
  const out = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw error;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function processCampaign(cfg) {
  const tpl = TEMPLATES[cfg.gradYear];

  // 2. update template copy
  const { error: upErr } = await supabase
    .from("campaigns")
    .update({ subject_template: tpl.subject, body_template: tpl.body })
    .eq("id", cfg.id);
  if (upErr) throw new Error(`template update: ${upErr.message}`);

  // leads for this grad year with valid email
  const leads = (await fetchAll(
    "leads",
    "id, first_name, last_name, full_name, email, club, league, grad_year, gpa, positions, age_group",
    (q) => q.eq("grad_year", cfg.gradYear).not("email", "is", null).ilike("email", "%@%"),
  )).map((l) => ({ ...l, gpa: l.gpa == null ? null : Number(l.gpa) }));

  // existing sends in this campaign
  const sends = await fetchAll(
    "email_sends",
    "id, lead_id, status",
    (q) => q.eq("campaign_id", cfg.id),
  );
  const existingLeadIds = new Set(sends.map((s) => s.lead_id));
  const queuedSends = sends.filter((s) => s.status === "queued");

  // 3. insert missing leads
  const newRows = [];
  const nowIso = new Date().toISOString();
  for (const lead of leads) {
    if (existingLeadIds.has(lead.id)) continue;
    const { subject, body } = renderEmail(tpl, lead);
    newRows.push({
      campaign_id: cfg.id,
      lead_id: lead.id,
      subject,
      body,
      status: "queued",
      scheduled_at: nowIso,
    });
  }
  let inserted = 0;
  for (let i = 0; i < newRows.length; i += 500) {
    const chunk = newRows.slice(i, i + 500);
    const { error, count } = await supabase.from("email_sends").insert(chunk, { count: "exact" });
    if (error) throw new Error(`insert: ${error.message}`);
    inserted += count ?? chunk.length;
  }

  // 4. re-render existing queued sends with new template
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const updates = [];
  for (const s of queuedSends) {
    const lead = leadById.get(s.lead_id);
    if (!lead) continue; // lead no longer matches filter; skip (do not touch)
    const { subject, body } = renderEmail(tpl, lead);
    updates.push({ id: s.id, subject, body });
  }
  let reRendered = 0;
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    const { data, error } = await supabase.rpc("bulk_update_send_content", { updates: chunk });
    if (error) throw new Error(`bulk_update: ${error.message}`);
    reRendered += data ?? chunk.length;
  }

  return {
    campaign: cfg.number,
    id: cfg.id,
    gradYear: cfg.gradYear,
    validLeads: leads.length,
    existingSends: sends.length,
    existingQueued: queuedSends.length,
    inserted,
    reRendered,
  };
}

const results = [];
for (const cfg of CAMPAIGNS) {
  results.push(await processCampaign(cfg));
}
console.log(JSON.stringify(results, null, 2));
