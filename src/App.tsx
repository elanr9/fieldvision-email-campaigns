import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CampaignList from "./components/CampaignList";
import CampaignDetail from "./components/CampaignDetail";
import NewCampaign from "./components/NewCampaign";
import { importCsv } from "./lib/api";
import { parseCsv } from "./lib/csv";
import {
  getCampaignDetail,
  getDashboard,
  sendDueNow,
  setCampaignStatus,
  type CampaignSendRow,
  type CampaignSummary,
} from "./lib/api";
import { supabase } from "./lib/supabase";

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [dashboardBusy, setDashboardBusy] = useState(true);
  const dashboardFirstDone = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<CampaignSendRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastDetailRefresh, setLastDetailRefresh] = useState<Date | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const list = await getDashboard();
      setCampaigns(list);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaigns";
      setError(message);
    } finally {
      if (!dashboardFirstDone.current) {
        dashboardFirstDone.current = true;
        setDashboardBusy(false);
      }
    }
  }, []);

  const refreshDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const rows = await getCampaignDetail(id);
      setDetailRows(rows);
      setLastDetailRefresh(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaign";
      showToast(message);
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDashboard();
    const id = window.setInterval(() => {
      void refreshDashboard();
    }, 30000);
    return () => window.clearInterval(id);
  }, [refreshDashboard]);

  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDetail(selectedId);
    const id = window.setInterval(() => {
      void refreshDetail(selectedId);
    }, 15000);
    return () => window.clearInterval(id);
  }, [selectedId, refreshDetail]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const stats = useMemo(() => {
    const totalSends = campaigns.reduce((acc, c) => acc + (c.total_sends ?? 0), 0);
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count ?? 0), 0);
    const totalOpened = campaigns.reduce((acc, c) => acc + (c.opened_count ?? 0), 0);
    const totalClicked = campaigns.reduce((acc, c) => acc + (c.clicked_count ?? 0), 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failed_count ?? 0), 0);
    const totalQueued = totalSends - totalSent - totalFailed;
    const openRate = totalSent > 0 ? totalOpened / totalSent : 0;
    const clickRate = totalSent > 0 ? totalClicked / totalSent : 0;
    return {
      campaigns: campaigns.length,
      sent: totalSent,
      opened: totalOpened,
      clicked: totalClicked,
      failed: totalFailed,
      queued: Math.max(totalQueued, 0),
      total: totalSends,
      openRate,
      clickRate,
    };
  }, [campaigns]);

  const handleTogglePause = async () => {
    if (!selectedCampaign) return;
    setTogglingPause(true);
    try {
      const next = selectedCampaign.status === "paused" ? "active" : "paused";
      await setCampaignStatus(selectedCampaign.id, next);
      showToast(`Campaign ${next === "paused" ? "paused" : "resumed"}`);
      refreshDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    } finally {
      setTogglingPause(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { showToast("No valid rows in CSV"); return; }
      const result = await importCsv(rows);
      showToast(`Imported ${result.imported} of ${result.total}. ${result.skipped} skipped`);
      void refreshDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const handleCreated = (id: string) => {
    setShowNew(false);
    setSelectedId(id);
    refreshDashboard();
  };

  const handleSendDue = async () => {
    setSending(true);
    try {
      const result = await sendDueNow();
      if (result.locked) {
        showToast("Rate limit: already sent 50 in the last hour");
      } else if (result.processed === 0) {
        showToast("No emails due right now");
      } else if (result.failed > 0 && result.sent === 0) {
        showToast(`All ${result.failed} failed to send`);
      } else if (result.failed > 0) {
        showToast(`${result.sent} sent, ${result.failed} failed`);
      } else {
        showToast(`${result.sent} emails sent`);
      }
      refreshDashboard();
      if (selectedId) refreshDetail(selectedId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      showToast(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-top">
          <div className="hero-text">
            <p className="eyebrow">FieldVision</p>
            <h1>Outreach CRM</h1>
          </div>
        </div>
        <div className="stats-launch">
          <div className={`stats-grid${dashboardBusy ? " stats-grid-pending" : ""}`}>
            <StatCard label="In Queue" value={stats.queued} />
            <StatCard label="Sent" value={stats.sent} />
            <StatCard label="Opened" value={`${stats.opened} (${formatPercent(stats.openRate)})`} />
            <StatCard label="Clicked" value={`${stats.clicked} (${formatPercent(stats.clickRate)})`} />
            <StatCard label="Failed" value={stats.failed} />
          </div>
        </div>
        <button type="button" className="ghost-btn" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      {toast ? <div className="toast">{toast}</div> : null}
      {error ? <div className="banner-error">{error}</div> : null}

      <section className="layout-grid">
        <aside className="left-rail">
          <CampaignList
            campaigns={campaigns}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNew={() => setShowNew(true)}
            onImport={() => importRef.current?.click()}
            importing={importing}
          />
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
          />
        </aside>

        <section className="main-col">
          <CampaignDetail
            campaign={selectedCampaign}
            rows={detailRows}
            loading={detailLoading}
            lastRefreshedAt={lastDetailRefresh}
            onSendBatch={handleSendDue}
            sending={sending}
            onTogglePause={handleTogglePause}
            togglingPause={togglingPause}
            onRefresh={() => { refreshDashboard(); if (selectedId) refreshDetail(selectedId); }}
            onToast={showToast}
          />
        </section>
      </section>

      {showNew ? (
        <NewCampaign
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
          onToast={showToast}
        />
      ) : null}
    </main>
  );
}
