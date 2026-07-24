import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { cleanClubName, splitName } from "../_shared/personalize.ts";

type Row = {
  full_name?: string;
  email?: string;
  phone_number?: string;
  age_group?: string;
  positions?: string;
  current_team?: string;
  league?: string;
  graduation_year?: string | number;
  gpa?: string | number;
  weighted_gpa?: string | number;
  [key: string]: unknown;
};

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = typeof value === "string" ? value.trim() : value;
  if (trimmed === "" || trimmed === "N/A" || trimmed === "n/a") return null;
  const n = typeof trimmed === "number" ? trimmed : Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toInt(value: unknown): number | null {
  const n = toNum(value);
  return n === null ? null : Math.trunc(n);
}

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as { rows?: Row[] };
    const rows = payload.rows ?? [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let skipped = 0;
    const total = rows.length;
    const records: Record<string, unknown>[] = [];

    for (const row of rows) {
      const email = (row.email ?? "").toString().trim().toLowerCase();
      if (!email.includes("@")) {
        skipped++;
        continue;
      }

      const fullName = (row.full_name ?? "").toString().trim();
      const { firstName, lastName } = splitName(fullName);

      records.push({
        full_name: fullName || email,
        first_name: firstName || null,
        last_name: lastName || null,
        email,
        phone: strOrNull(row.phone_number),
        club: cleanClubName(strOrNull(row.current_team) ?? "") || null,
        league: strOrNull(row.league),
        grad_year: toInt(row.graduation_year),
        gpa: toNum(row.gpa),
        weighted_gpa: toNum(row.weighted_gpa),
        positions: strOrNull(row.positions),
        age_group: strOrNull(row.age_group),
        raw: row,
      });
    }

    let imported = 0;
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error, count } = await supabase
        .from("leads")
        .upsert(chunk, { onConflict: "email", count: "exact" });
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message, imported, skipped, total }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      imported += count ?? chunk.length;
    }

    return new Response(
      JSON.stringify({ imported, skipped, total }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
