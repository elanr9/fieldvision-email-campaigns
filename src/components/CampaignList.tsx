import type { CampaignSummary } from "../lib/api";

type Props = {
  campaigns: CampaignSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport?: () => void;
  importing?: boolean;
};

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

export default function CampaignList({ campaigns, selectedId, onSelect, onNew, onImport, importing }: Props) {
  return (
    <section className="card campaign-list">
      <div className="campaign-list-header">
        <h2>Campaigns</h2>
        <button type="button" className="primary-btn" onClick={onNew}>
          New
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">No campaigns yet</div>
      ) : (
        <div className="campaign-rows">
          {campaigns.map((c) => {
            const active = c.id === selectedId;
            const total = c.total_sends || 1;
            const sentPct = Math.min(100, (c.sent_count / total) * 100);
            const openPct = Math.min(100, (c.opened_count / total) * 100);
            const queued = Math.max(c.total_sends - c.sent_count - c.failed_count, 0);
            return (
              <button
                key={c.id}
                type="button"
                className={`campaign-row ${active ? "active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="campaign-number">#{c.number}</span>
                <span className="campaign-info">
                  <span className="campaign-name-row">
                    <strong>{c.name}</strong>
                    {c.status === "paused" ? (
                      <span className="campaign-status-badge">Paused</span>
                    ) : null}
                  </span>
                  <span className="campaign-progress-bar">
                    <span className="campaign-progress-sent" style={{ width: `${sentPct}%` }} />
                    <span className="campaign-progress-open" style={{ width: `${openPct}%` }} />
                  </span>
                  <small className="campaign-sub">
                    {c.sent_count} sent &nbsp;{formatPercent(c.open_rate)} open &nbsp;{formatPercent(c.click_rate)} click &nbsp;{queued} queued
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {onImport ? (
        <button
          type="button"
          className="import-link"
          onClick={onImport}
          disabled={importing}
        >
          {importing ? "Importing" : "+ Import leads CSV"}
        </button>
      ) : null}
    </section>
  );
}
