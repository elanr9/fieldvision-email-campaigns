import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  defaultBodyTemplate,
  defaultSubjectTemplate,
  renderEmail,
  type Lead,
} from "../_shared/personalize.ts";

type Body = {
  name?: string;
  subject_template?: string;
  body_template?: string;
  lead_filter?: { grad_years?: number[] };
};

type LeadRow = Lead & { id: string };

const THROTTLE_SECONDS = 0;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.name) {
      return new Response(
        JSON.stringify({ error: "name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subjectTemplate = body.subject_template ?? defaultSubjectTemplate();
    const bodyTemplate = body.body_template ?? defaultBodyTemplate();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: numberData, error: numberError } = await supabase.rpc("next_campaign_number");
    if (numberError) throw numberError;
    const number = Number(numberData);

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        number,
        name: body.name,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
      })
      .select()
      .single();
    if (campaignError) throw campaignError;

    let leadsQuery = supabase
      .from("leads")
      .select(
        "id, full_name, first_name, last_name, email, club, league, grad_year, gpa, positions, age_group",
      );

    if (body.lead_filter?.grad_years && body.lead_filter.grad_years.length > 0) {
      leadsQuery = leadsQuery.in("grad_year", body.lead_filter.grad_years);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) throw leadsError;

    const now = Date.now();
    const sends = ((leads ?? []) as LeadRow[]).map((lead, i) => {
      const rendered = renderEmail(
        { subject: subjectTemplate, body: bodyTemplate },
        lead,
      );
      return {
        campaign_id: campaign.id as string,
        lead_id: lead.id,
        subject: rendered.subject,
        body: rendered.body,
        scheduled_at: new Date(now + i * THROTTLE_SECONDS * 1000).toISOString(),
        status: "queued",
      };
    });

    const chunkSize = 500;
    for (let i = 0; i < sends.length; i += chunkSize) {
      const chunk = sends.slice(i, i + chunkSize);
      const { error } = await supabase.from("email_sends").insert(chunk);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        campaign_id: campaign.id,
        number: campaign.number,
        queued: sends.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
