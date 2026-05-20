import { supabase } from "./supabase";
import type { CsvRow } from "./csv";

export type CampaignStatus = "active" | "paused" | "complete";

export type CampaignSummary = {
  id: string;
  number: number;
  name: string;
  status: CampaignStatus;
  created_at: string;
  total_sends: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  open_rate: number;
  click_rate: number;
};

export type CampaignSendStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

export type CampaignSendRow = {
  send_id: string;
  status: CampaignSendStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  subject: string;
  body: string;
  lead_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  club: string | null;
  league: string | null;
  grad_year: number | null;
  gpa: number | null;
  positions: string | null;
  age_group: string | null;
};

export type LeadFilter = {
  grad_years?: number[];
};

export type CreateCampaignPayload = {
  name: string;
  subject_template?: string;
  body_template?: string;
  lead_filter?: LeadFilter;
};

export async function importCsv(rows: CsvRow[]): Promise<{ imported: number; skipped: number; total: number }> {
  const { data, error } = await supabase.functions.invoke<{
    imported: number;
    skipped: number;
    total: number;
  }>("import-csv", {
    body: { rows },
  });
  if (error) throw error;
  if (!data) throw new Error("import-csv returned no data");
  return data;
}

export async function createCampaign(
  payload: CreateCampaignPayload
): Promise<{ campaign_id: string; number: number; queued: number }> {
  const { data, error } = await supabase.functions.invoke<{
    campaign_id: string;
    number: number;
    queued: number;
  }>("create-campaign", {
    body: payload,
  });
  if (error) throw error;
  if (!data) throw new Error("create-campaign returned no data");
  return data;
}

export async function sendDueNow(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  locked?: boolean;
  message?: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    processed: number;
    sent: number;
    failed: number;
    locked?: boolean;
    message?: string;
  }>("send-due", {
    body: {},
  });
  if (error) throw error;
  if (!data) throw new Error("send-due returned no data");
  return data;
}

export async function getDashboard(): Promise<CampaignSummary[]> {
  const { data, error } = await supabase.rpc("dashboard_overview");
  if (error) throw error;
  return (data ?? []) as CampaignSummary[];
}

export async function getCampaignDetail(campaignId: string): Promise<CampaignSendRow[]> {
  const { data, error } = await supabase.rpc("campaign_detail", { campaign_uuid: campaignId });
  if (error) throw error;
  return (data ?? []) as CampaignSendRow[];
}

export type CampaignTemplate = {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  status: CampaignStatus;
};

export async function getCampaignTemplate(campaignId: string): Promise<CampaignTemplate> {
  const { data, error } = await supabase.rpc("get_campaign_template", {
    campaign_uuid: campaignId,
  });
  if (error) throw error;
  const rows = (data ?? []) as CampaignTemplate[];
  if (!rows[0]) throw new Error("Campaign not found");
  return rows[0];
}

export async function updateCampaign(
  campaignId: string,
  subjectTemplate: string,
  bodyTemplate: string,
): Promise<{ updated: number }> {
  const { data, error } = await supabase.functions.invoke<{ updated: number }>(
    "update-campaign",
    { body: { campaign_id: campaignId, subject_template: subjectTemplate, body_template: bodyTemplate } },
  );
  if (error) throw error;
  if (!data) throw new Error("update-campaign returned no data");
  return data;
}

export async function sendTestEmail(campaignId: string, toEmail: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
    "send-test",
    { body: { campaign_id: campaignId, to_email: toEmail } },
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  const { error } = await supabase.rpc("set_campaign_status", {
    campaign_uuid: campaignId,
    new_status: status,
  });
  if (error) throw error;
}
