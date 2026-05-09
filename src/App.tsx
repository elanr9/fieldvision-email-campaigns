import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CampaignList from "./components/CampaignList";
import CampaignDetail from "./components/CampaignDetail";
import NewCampaign from "./components/NewCampaign";
import ImportPanel from "./components/ImportPanel";
import {
  getCampaignDetail,
  getDashboard,
  sendDueNow,
  type CampaignSendRow,
  type CampaignSummary,
} from "./lib/api";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<CampaignSendRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastDetailRefresh, setLastDetailRefresh] = useState<Date | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        showToast(result.message ?? "Rate limit. Try again later");
      } else {
        showToast(`${result.sent} sent. ${result.failed} failed`);
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
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">FieldVision</p>
          <h1>FieldVision Outreach CRM</h1>
          <p className="hero-copy">
            Import your outreach list, queue personalized campaigns, and track open rates as emails go out.
          </p>
        </div>
        <div className="stats-grid">
          <StatCard label="Leads in queue" value={stats.queued} />
          <StatCard label="Sent" value={stats.sent} />
          <StatCard label="Opened" value={`${stats.opened} (${formatPercent(stats.openRate)})`} />
          <StatCard label="Clicked website" value={`${stats.clicked} (${formatPercent(stats.clickRate)})`} />
          <StatCard label="Failed" value={stats.failed} />
        </div>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
      {error ? <div className="banner-error">{error}</div> : null}

      <section className="layout-grid">
        <aside className="left-rail">
          <CampaignList
            campaigns={campaigns}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNew={() => setShowNew(true)}
          />
          <ImportPanel onImported={refreshDashboard} onToast={showToast} />
        </aside>

        <section className="main-col">
          <CampaignDetail
            campaign={selectedCampaign}
            rows={detailRows}
            loading={detailLoading}
            lastRefreshedAt={lastDetailRefresh}
            onSendBatch={handleSendDue}
            sending={sending}
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
