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
