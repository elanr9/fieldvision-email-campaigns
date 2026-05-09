import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function gifBytes(): Uint8Array {
  const binary = atob(GIF_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const UUID_RE = /\/p\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.gif$/;

serve((req: Request) => {
  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const match = url.pathname.match(UUID_RE);
    const sendId = match?.[1];

    if (sendId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      // fire and forget; do not await
      supabase
        .rpc("track_email_open", { send_uuid: sendId })
        .then(() => {})
        .catch(() => {});
    }
  } catch {
    // swallow; always return the pixel
  }

  return new Response(gifBytes(), { status: 200, headers: responseHeaders });
});
