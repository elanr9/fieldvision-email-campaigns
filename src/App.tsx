import { useEffect, useMemo, useState } from "react";
import "./App.css";

type LeadStatus = "draft" | "approved" | "queued" | "sent" | "replied" | "unsubscribed";

type AthleteLead = {
  id: string;
  club: string;
  firstName: string;
  lastName: string;
  gradYear: string;
  positions: string;
  gpa: string;
  email: string;
  phone: string;
  status: LeadStatus;
  schools: string[];
  subject: string;
  body: string;
  scheduledAt: string | null;
};

const storageKey = "fieldvision_outreach_crm_leads_v1";

const sampleData = `Dallas Texans ECNL-RL 2007/2008 B\tZeke\tHayes\t2026\tM/DM\t3.89\tzekehayes2008@gmail.com\t817-733-8974
Dallas Texans ECNL-RL 2007/2008 B\tJoshua\tArellano\t2027\tRB/CDM/RW\tN/A\tjosh.carel210@gmail.com\t682-249-2011
Dallas Texans ECNL-RL 2007/2008 B\tEmmanuel\tMendez\t2027\tW/ST\tN/A\temendezgil8@icloud.com\t469-841-3382
Dallas Texans ECNL-RL 2007/2008 B\tEnzo\tFartura\t2026\tCAM/CDM/ST\t3.75\tEnzofartura@live.com\tN/A`;

const schoolsByGpa = {
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

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseRows(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const delimiter = (raw.match(/\t/g) || []).length > (raw.match(/,/g) || []).length ? "\t" : ",";

  return lines.map((line) => splitDelimitedLine(line, delimiter));
}

function looksLikeHeader(row: string[]) {
  const joined = row.join(" ").toLowerCase();
  return joined.includes("email") || joined.includes("grad") || joined.includes("gpa");
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function getSchoolMatches(gpaValue: string) {
  const gpa = Number.parseFloat(gpaValue);

  if (Number.isNaN(gpa)) return schoolsByGpa.unknown;
  if (gpa >= 3.75) return schoolsByGpa.high;
  if (gpa >= 3.2) return schoolsByGpa.mid;
  return schoolsByGpa.developing;
}

function getGradYearAngle(gradYear: string) {
  if (gradYear === "2026") {
    return "Since you are in the 2026 class, the biggest thing is getting in front of the right college programs while coaches are still filling needs.";
  }

  if (gradYear === "2027") {
    return "Since you are in the 2027 class, this is a good time to build a real college list before junior year gets crowded.";
  }

  if (gradYear === "2028") {
    return "Since you are in the 2028 class, starting early can help you learn which programs fit before outreach gets serious.";
  }

  return "Based on your class year, this is a good time to start narrowing down programs that fit your soccer and academic profile.";
}

function buildEmail(lead: Omit<AthleteLead, "id" | "status" | "schools" | "subject" | "body" | "scheduledAt">) {
  const schools = getSchoolMatches(lead.gpa);
  const gpaLine =
    lead.gpa && lead.gpa.toLowerCase() !== "n/a"
      ? `With your ${lead.gpa} GPA and ${lead.club} background, I think you could have a real conversation with programs like ${schools.slice(0, 5).join(", ")}.`
      : `With your ${lead.club} background, I think you could start with programs like ${schools.slice(0, 5).join(", ")} and then narrow the list by academics.`;

  return {
    schools,
    subject: `${lead.firstName}, college soccer options for ${lead.gradYear}`,
    body: `Hi ${lead.firstName},

I saw you play with ${lead.club} and wanted to reach out because your profile stood out.

${getGradYearAngle(lead.gradYear)}

${gpaLine}

I put together a short list of ten schools that could be worth looking at:
${schools.map((school, index) => `${index + 1}. ${school}`).join("\n")}

If you want, I can send over a simple plan for how I would start outreach for a ${lead.positions || "soccer"} player in the ${lead.gradYear} class.

Best,
FieldVision Outreach`,
  };
}

function normalizeLead(row: string[], headers?: string[]) {
  const lowerHeaders = headers?.map((header) => header.toLowerCase().trim()) ?? [];
  const getByHeader = (candidates: string[], fallbackIndex: number) => {
    const index = findHeaderIndex(lowerHeaders, candidates);
    return row[index >= 0 ? index : fallbackIndex]?.trim() ?? "";
  };

  const base = {
    club: getByHeader(["club", "team"], 0),
    firstName: getByHeader(["first", "first name"], 1),
    lastName: getByHeader(["last", "last name"], 2),
    gradYear: getByHeader(["grad", "year", "class"], 3),
    positions: getByHeader(["position", "pos"], 4),
    gpa: getByHeader(["gpa"], 5) || "N/A",
    email: getByHeader(["email"], 6).toLowerCase(),
    phone: getByHeader(["phone", "mobile"], 7),
  };
  const email = buildEmail(base);

  return {
    id: crypto.randomUUID(),
    ...base,
    status: "draft" as LeadStatus,
    schools: email.schools,
    subject: email.subject,
    body: email.body,
    scheduledAt: null,
  };
}

function parseLeads(raw: string) {
  const rows = parseRows(raw);
  if (!rows.length) return [];

  const hasHeader = looksLikeHeader(rows[0]);
  const headers = hasHeader ? rows[0] : undefined;
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  return bodyRows
    .map((row) => normalizeLead(row, headers))
    .filter((lead) => lead.email.includes("@") && lead.firstName);
}

function scheduleLeads(leads: AthleteLead[]) {
  const start = new Date();

  return leads.map((lead, index) => {
    if (lead.status === "unsubscribed" || lead.status === "sent" || lead.status === "replied") return lead;
    const secondsOffset = Math.floor(index / 50) * 3600 + (index % 50) * 72;

    return {
      ...lead,
      status: "queued" as LeadStatus,
      scheduledAt: new Date(start.getTime() + secondsOffset * 1000).toISOString(),
    };
  });
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeCsv(value: string | null) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function loadSavedLeads() {
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return [];

  try {
    return JSON.parse(saved) as AthleteLead[];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function App() {
  const [rawInput, setRawInput] = useState(sampleData);
  const [leads, setLeads] = useState<AthleteLead[]>(loadSavedLeads);
  const [selectedId, setSelectedId] = useState<string | null>(() => leads[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(leads));
  }, [leads]);

  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? leads[0] ?? null;

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const searchable = `${lead.firstName} ${lead.lastName} ${lead.club} ${lead.email}`.toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [leads, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      draft: leads.filter((lead) => lead.status === "draft").length,
      queued: leads.filter((lead) => lead.status === "queued").length,
      sent: leads.filter((lead) => lead.status === "sent").length,
      replied: leads.filter((lead) => lead.status === "replied").length,
    }),
    [leads],
  );

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const importLeads = () => {
    const parsed = parseLeads(rawInput);
    if (!parsed.length) {
      flash("No valid leads found");
      return;
    }

    setLeads(parsed);
    setSelectedId(parsed[0]?.id ?? null);
    flash(`Imported ${parsed.length} leads`);
  };

  const updateLead = (id: string, updates: Partial<AthleteLead>) => {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...updates } : lead)));
  };

  const approveAll = () => {
    setLeads((current) =>
      current.map((lead) => (lead.status === "draft" ? { ...lead, status: "approved" as LeadStatus } : lead)),
    );
    flash("Drafts approved");
  };

  const queueCampaign = () => {
    setLeads((current) => scheduleLeads(current));
    flash("Campaign queued at 50 emails per hour");
  };

  const copySelected = async () => {
    if (!selectedLead) return;
    await navigator.clipboard.writeText(`Subject: ${selectedLead.subject}\n\n${selectedLead.body}`);
    flash("Email copied");
  };

  const exportCsv = () => {
    const headers = [
      "first_name",
      "last_name",
      "club",
      "grad_year",
      "positions",
      "gpa",
      "email",
      "phone",
      "status",
      "scheduled_at",
      "subject",
      "body",
      "school_matches",
    ];

    const rows = leads.map((lead) =>
      [
        lead.firstName,
        lead.lastName,
        lead.club,
        lead.gradYear,
        lead.positions,
        lead.gpa,
        lead.email,
        lead.phone,
        lead.status,
        lead.scheduledAt,
        lead.subject,
        lead.body,
        lead.schools.join("; "),
      ]
        .map(escapeCsv)
        .join(","),
    );

    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "outreach-crm-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setRawInput(await file.text());
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Internal outreach CRM</p>
          <h1>CSV campaign builder</h1>
          <p className="hero-copy">
            Import athlete rows, generate personalized drafts, approve leads, and queue the campaign at 50 emails per hour.
          </p>
        </div>
        <div className="stats-grid">
          <StatCard label="Leads" value={stats.total} />
          <StatCard label="Drafts" value={stats.draft} />
          <StatCard label="Queued" value={stats.queued} />
          <StatCard label="Replies" value={stats.replied} />
        </div>
      </section>

      {message ? <div className="toast">{message}</div> : null}

      <section className="layout-grid">
        <aside className="sidebar">
          <section className="card">
            <div className="card-header">
              <h2>Import</h2>
              <p>Paste CSV or tab data with club, first, last, grad year, position, GPA, email, and phone.</p>
            </div>
            <textarea className="raw-input" value={rawInput} onChange={(event) => setRawInput(event.target.value)} />
            <div className="button-row">
              <button type="button" onClick={importLeads}>Import leads</button>
              <label className="file-button">
                Upload file
                <input type="file" accept=".csv,.txt,.tsv" onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Controls</h2>
              <p>Review before queueing. Suppressed and sent leads are skipped.</p>
            </div>
            <button type="button" className="secondary-button" onClick={approveAll} disabled={!leads.length}>Approve all drafts</button>
            <button type="button" onClick={queueCampaign} disabled={!leads.length}>Queue 50 per hour</button>
            <button type="button" className="secondary-button" onClick={exportCsv} disabled={!leads.length}>Export CSV</button>
          </section>
        </aside>

        <section className="main-grid">
          <section className="card leads-card">
            <div className="card-header leads-header">
              <div>
                <h2>Leads</h2>
                <p>Search, review, and update each athlete.</p>
              </div>
              <div className="filters">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}>
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="queued">Queued</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>
            </div>

            {!visibleLeads.length ? (
              <div className="empty-state">No leads yet. Import the sample data or upload your file.</div>
            ) : (
              <div className="lead-list">
                {visibleLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className={`lead-row ${selectedLead?.id === lead.id ? "active" : ""}`}
                    onClick={() => setSelectedId(lead.id)}
                  >
                    <span>
                      <strong>{lead.firstName} {lead.lastName}</strong>
                      <small>{lead.club}</small>
                      <small>{lead.gradYear} class | {lead.positions || "Position needed"} | {lead.gpa || "N/A"} GPA</small>
                    </span>
                    <span className="lead-meta">
                      <span className={`badge ${lead.status}`}>{lead.status}</span>
                      <small>{lead.email}</small>
                      <small>{formatDate(lead.scheduledAt)}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card preview-card">
            <div className="card-header">
              <h2>Email preview</h2>
              <p>Edit the generated draft before sending.</p>
            </div>

            {!selectedLead ? (
              <div className="empty-state">Select a lead to preview the email.</div>
            ) : (
              <>
                <input
                  value={selectedLead.subject}
                  onChange={(event) => updateLead(selectedLead.id, { subject: event.target.value })}
                  aria-label="Subject"
                />
                <select
                  value={selectedLead.status}
                  onChange={(event) => updateLead(selectedLead.id, { status: event.target.value as LeadStatus })}
                  aria-label="Status"
                >
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="queued">Queued</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
                <textarea
                  className="email-body"
                  value={selectedLead.body}
                  onChange={(event) => updateLead(selectedLead.id, { body: event.target.value })}
                />
                <div>
                  <p className="school-title">School matches</p>
                  <div className="school-list">
                    {selectedLead.schools.map((school) => (
                      <span key={school}>{school}</span>
                    ))}
                  </div>
                </div>
                <button type="button" className="secondary-button" onClick={copySelected}>Copy email</button>
              </>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
