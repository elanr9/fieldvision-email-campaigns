/**
 * One-time script to get a Gmail refresh token for founders@fieldvisionai.com.
 *
 * Prerequisites:
 *   1. In Google Cloud Console → "FV Founders Email Access" project:
 *      - Go to APIs & Services → Credentials → your Web OAuth client
 *      - Add "http://localhost:3000/callback" to Authorized redirect URIs
 *      - Save
 *   2. Enable the Gmail API in that project (APIs & Services → Enable APIs → Gmail API)
 *
 * Run:
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/get-gmail-token.mjs
 *
 * Then paste the supabase secrets commands it prints into your terminal.
 */

import { createServer } from "http";
import { URL } from "url";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET as env vars before running.");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPE = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent"); // forces a fresh refresh token

console.log("\n1. Open this URL in your browser (sign in as founders@fieldvisionai.com):\n");
console.log(authUrl.toString());
console.log("\n2. Waiting for OAuth callback on http://localhost:3000/callback...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  const code = url.searchParams.get("code");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    res.end(`Error: ${errParam}`);
    console.error("OAuth error:", errParam);
    server.close();
    return;
  }

  if (!code) {
    res.end("No authorization code received.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  res.end("<h2>Done! Check your terminal.</h2>");

  if (!tokens.refresh_token) {
    console.error("\nNo refresh_token in response:", tokens);
    console.error("Make sure you added prompt=consent and the account hasn't already granted access.");
    server.close();
    return;
  }

  console.log("\n✅ Got tokens. Run these commands:\n");
  console.log(`supabase secrets set GMAIL_CLIENT_ID="${CLIENT_ID}"`);
  console.log(`supabase secrets set GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`);
  console.log(`supabase secrets set GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);
  console.log(`supabase secrets set GMAIL_FROM="Elan | FieldVision <founders@fieldvisionai.com>"`);
  server.close();
});

server.listen(3000);
