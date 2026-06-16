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
const LOGO_URL =
  "https://cjutymkbpcwnxbepnnty.supabase.co/storage/v1/object/public/assets/fv-logo.png";
const TRACKED_DOMAIN = "https://fieldvisionai.com";

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      `Gmail token refresh failed: ${json.error_description ?? json.error ?? res.status}`,
    );
  }
  return json.access_token!;
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeBase64Url(text: string): string {
  return encodeBase64(text)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bodyToParagraphs(body: string): string {
  return body
    .split(/\n\n+/)
    .map((para) => {
      const escaped = escapeHtml(para.trim()).replace(/\n/g, "<br>");
      if (!escaped) return "";
      return `<p style="margin:0 0 16px">${escaped}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function buildHtml(body: string, pixelUrl: string, clickUrl: string): string {
  const paragraphs = bodyToParagraphs(body);

  const button = `
<div style="margin:28px 0">
  <a href="${clickUrl}"
     style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;line-height:1">
    See if you're a fit &rarr;
  </a>
</div>`;

  const signature = `
<div style="margin-top:32px;font-size:14px;color:#334155;line-height:1.7">
  Best,<br>
  <strong>Sebas</strong><br>
  Co-Founder, FieldVision AI
</div>
<div style="margin-top:14px">
  <img src="${LOGO_URL}" width="36" height="36" alt="FieldVision AI" style="display:block;opacity:0.8;border:0">
</div>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;-webkit-font-smoothing:antialiased">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-size:15px">
    ${paragraphs}
    ${button}
    ${signature}
    <img src="${pixelUrl}" width="1" height="1" alt="" style="display:none">
  </div>
</body>
</html>`;
}

function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): string {
  const encSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${encodeBase64(subject)}?=`;

  const boundary = `fv_${Date.now()}`;
  const message = [
    `MIME-Version: 1.0`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encSubject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodeBase64(text),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodeBase64(html),
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return encodeBase64Url(message);
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
  const gmailClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const gmailClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const gmailRefreshToken = Deno.env.get("FOUNDERS_GMAIL_REFRESH_TOKEN") ?? "";
  const gmailFrom = Deno.env.get("GMAIL_FROM") ?? "Sebas | FieldVision <founders@fieldvisionai.com>";

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    return new Response(
      JSON.stringify({
        error: "Gmail credentials not set (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / FOUNDERS_GMAIL_REFRESH_TOKEN).",
        processed: 0,
        sent: 0,
        failed: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 60-minute rate limit
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
        message: `Rate limit: 50 emails already sent in the last ${LOCKOUT_MINUTES} min`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Refresh Gmail access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken(gmailClientId, gmailClientSecret, gmailRefreshToken);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, processed: 0, sent: 0, failed: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await supabase.rpc("claim_due_sends", {
    limit_count: BATCH_LIMIT,
  });
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
      const raw = buildRawEmail(gmailFrom, row.email, row.subject, html, row.body);

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        },
      );

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string };
      };

      if (!res.ok) {
        const message = json.error?.message ?? `Gmail API error ${res.status}`;
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
      await new Promise((r) => setTimeout(r, 200));
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
