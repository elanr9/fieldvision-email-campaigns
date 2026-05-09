import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Claimed = {
  id: string;
  campaign_id: string;
  lead_id: string;
  subject: string;
  body: string;
  scheduled_at: string;
  email: string;
  full_name: string;
  first_name: string | null;
};

const BATCH_LIMIT = 50;
const LOCKOUT_MINUTES = 30;
const LOGO_URL = "https://cjutymkbpcwnxbepnnty.supabase.co/storage/v1/object/public/assets/fv-logo.png";
const TRACKED_URL = "https://fieldvisionai.com";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(body: string, pixelUrl: string, clickUrl: string): string {
  const escaped = escapeHtml(body)
    .replace(/https:\/\/fieldvisionai\.com/g, `<a href="${clickUrl}" style="color:#2563eb;text-decoration:underline">${TRACKED_URL}</a>`)
    .replace(/\n/g, "<br/>");
  const logoTop = `<div style="margin-bottom:16px"><img src="${LOGO_URL}" width="80" height="80" alt="FieldVision" style="display:block;border:0;outline:none" /></div>`;
  const logoSig = `<div style="margin-top:16px"><img src="${LOGO_URL}" width="56" height="56" alt="FieldVision" style="display:block;border:0;outline:none" /></div>`;
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.5">${logoTop}${escaped}${logoSig}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" /></body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const resendFrom = Deno.env.get("RESEND_FROM") ?? "";

  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count: recentCount, error: lockErr } = await supabase
    .from("email_sends")
    .select("id", { head: true, count: "exact" })
    .eq("status", "sent")
    .gte("sent_at", cutoff);
  if (lockErr) {
    return new Response(
      JSON.stringify({ error: lockErr.message, processed: 0, sent: 0, failed: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if ((recentCount ?? 0) > 0) {
    return new Response(
      JSON.stringify({
        processed: 0,
        sent: 0,
        failed: 0,
        locked: true,
        lockout_minutes: LOCKOUT_MINUTES,
        message: `Rate limit. Try again in up to ${LOCKOUT_MINUTES} min`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await supabase.rpc("claim_due_sends", { limit_count: BATCH_LIMIT });
  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, processed: 0, sent: 0, failed: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const claimed = (data ?? []) as Claimed[];
  let sent = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      const pixelUrl = `${supabaseUrl}/functions/v1/track-open/p/${row.id}.gif`;
      const clickUrl = `${supabaseUrl}/functions/v1/track-click/c/${row.id}`;
      const html = buildHtml(row.body, pixelUrl, clickUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [row.email],
          subject: row.subject,
          html,
          text: row.body,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

      if (!res.ok) {
        const message = json.message || `Resend error ${res.status}`;
        await supabase
          .from("email_sends")
          .update({ status: "failed", error: message })
          .eq("id", row.id);
        failed++;
        continue;
      }

      await supabase
        .from("email_sends")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: json.id ?? null,
        })
        .eq("id", row.id);
      sent++;
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      await supabase
        .from("email_sends")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", row.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ processed: claimed.length, sent, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
