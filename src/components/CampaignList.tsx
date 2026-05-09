import type { CampaignSummary } from "../lib/api";

type Props = {
  campaigns: CampaignSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

export default function CampaignList({ campaigns, selectedId, onSelect, onNew }: Props) {
  return (
    <section className="card campaign-list">
      <div className="campaign-list-header">
        <h2>Campaigns</h2>
        <button type="button" className="primary-btn" onClick={onNew}>
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">No campaigns yet</div>
      ) : (
        <div className="campaign-rows">
          {campaigns.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                className={`campaign-row ${active ? "active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="campaign-number">#{c.number}</span>
                <span className="campaign-info">
                  <strong>{c.name}</strong>
                  <small>
                    {c.sent_count} sent | {c.opened_count} opened | {c.clicked_count} clicked
                  </small>
                  <small className="campaign-sub">
                    {formatPercent(c.open_rate)} open | {formatPercent(c.click_rate)} click | {Math.max(c.total_sends - c.sent_count - c.failed_count, 0)} queued
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
