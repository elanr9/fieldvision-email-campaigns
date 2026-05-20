import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { renderEmail, type Lead } from "../_shared/personalize.ts";

type Body = {
  campaign_id: string;
  subject_template: string;
  body_template: string;
};

type SendRow = {
  id: string;
  lead_id: string;
  leads: Lead & { full_name: string };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.campaign_id || !body?.subject_template || !body?.body_template) {
      return new Response(
        JSON.stringify({ error: "campaign_id, subject_template, and body_template are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Update campaign table
    const { error: campaignErr } = await supabase
      .from("campaigns")
      .update({
        subject_template: body.subject_template,
        body_template: body.body_template,
      })
      .eq("id", body.campaign_id);
    if (campaignErr) throw campaignErr;

    // Get all queued sends with lead data
    const { data: sends, error: sendsErr } = await supabase
      .from("email_sends")
      .select(
        "id, lead_id, leads(full_name, first_name, last_name, email, club, league, grad_year, gpa, positions, age_group)",
      )
      .eq("campaign_id", body.campaign_id)
      .eq("status", "queued");
    if (sendsErr) throw sendsErr;

    const rows = (sends ?? []) as SendRow[];

    // Re-render each send
    const updates = rows.map((row) => {
      const rendered = renderEmail(
        { subject: body.subject_template, body: body.body_template },
        row.leads,
      );
      return { id: row.id, subject: rendered.subject, body: rendered.body };
    });

    // Bulk update via single DB call
    const { error: bulkErr } = await supabase.rpc("bulk_update_send_content", {
      updates: updates,
    });
    if (bulkErr) throw bulkErr;

    return new Response(
      JSON.stringify({ updated: updates.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
