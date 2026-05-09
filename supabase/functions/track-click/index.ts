import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const UUID_RE = /\/c\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const DESTINATION = "https://fieldvisionai.com";

serve((req: Request) => {
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
      supabase
        .rpc("track_email_click", { send_uuid: sendId })
        .then(() => {})
        .catch(() => {});
    }
  } catch {
    // ignore; always redirect
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: DESTINATION,
      "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
    },
  });
});
