import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { renderEmail } from "../_shared/personalize.ts";

const LOGO_URL =
  "https://cjutymkbpcwnxbepnnty.supabase.co/storage/v1/object/public/assets/fv-logo.png";

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
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
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok) throw new Error(`Token refresh failed: ${json.error_description ?? res.status}`);
  return json.access_token!;
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function encodeBase64Url(text: string): string {
  return encodeBase64(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bodyToParagraphs(body: string): string {
  return body
    .split(/\n\n+/)
    .map((para) => {
      const escaped = escapeHtml(para.trim()).replace(/\n/g, "<br>");
      return escaped ? `<p style="margin:0 0 16px">${escaped}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

function buildHtml(body: string, ctaUrl: string, firstName: string): string {
  const paragraphs = bodyToParagraphs(body);
  const button = `<div style="margin:28px 0"><a href="${ctaUrl}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;line-height:1">Start free-trial now &rarr;</a></div>`;
  const outro = `<p style="margin:0 0 16px">Whether you hop on or not, feel free to text/call me anytime about college soccer, my personal number's below.</p>`;
  const greetName = firstName.trim() ? ` ${escapeHtml(firstName.trim())}` : "";
  const signature = `<div style="margin-top:32px;font-size:14px;color:#334155;line-height:1.7">Have a great day${greetName},<br><strong>Elan Romo</strong><br>Co-founder &amp; CEO, FieldVision AI<br>954-770-9208</div><div style="margin-top:14px"><img src="${LOGO_URL}" width="36" height="36" alt="FieldVision AI" style="display:block;opacity:0.8;border:0"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;-webkit-font-smoothing:antialiased"><div style="max-width:560px;margin:0 auto;padding:40px 24px;font-size:15px">${paragraphs}${button}${outro}${signature}</div></body></html>`;
}

function buildRaw(from: string, to: string, subject: string, html: string, text: string): string {
  const encSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${encodeBase64(subject)}?=`;
  const boundary = `fv_test_${Date.now()}`;
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to_email, campaign_id } = (await req.json()) as { to_email: string; campaign_id: string };
    if (!to_email || !campaign_id) {
      return new Response(JSON.stringify({ error: "to_email and campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const gmailFrom = Deno.env.get("GMAIL_FROM") ?? "Sebas | FieldVision <founders@fieldvisionai.com>";
    const accessToken = await getAccessToken(
      Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      Deno.env.get("FOUNDERS_GMAIL_REFRESH_TOKEN") ?? "",
    );

    const { data: rows } = await supabase
      .from("campaigns")
      .select("subject_template, body_template")
      .eq("id", campaign_id)
      .single();

    const sampleLead = {
      first_name: "Alex",
      last_name: "Rivera",
      full_name: "Alex Rivera",
      club: "Dallas Texans",
      grad_year: 2026,
      gpa: 3.5,
      positions: "CAM",
    };

    const rendered = renderEmail(
      { subject: rows?.subject_template ?? "", body: rows?.body_template ?? "" },
      sampleLead,
    );

    const html = buildHtml(rendered.body, "https://fieldvisionai.com", sampleLead.first_name);
    const raw = buildRaw(gmailFrom, to_email, `[TEST] ${rendered.subject}`, html, rendered.body);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });

    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `Gmail API ${res.status}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
