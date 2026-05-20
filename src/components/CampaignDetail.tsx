import { Fragment, useState } from "react";
import type { CampaignSummary, CampaignSendRow } from "../lib/api";
import { sendTestEmail } from "../lib/api";
import { FV_LOGO_URL } from "../lib/personalize";
import EditCampaign from "./EditCampaign";

type Props = {
  campaign: CampaignSummary | null;
  rows: CampaignSendRow[];
  loading: boolean;
  lastRefreshedAt: Date | null;
  onSendBatch?: () => void;
  sending?: boolean;
  onTogglePause?: () => void;
  togglingPause?: boolean;
  onRefresh?: () => void;
  onToast?: (msg: string) => void;
};

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function fmtDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return dateFmt.format(d);
}

function fmtGpa(gpa: number | null): string {
  if (gpa == null || Number.isNaN(gpa)) return "N/A";
  return gpa.toFixed(2);
}

function fmtPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

export default function CampaignDetail({
  campaign, rows, loading, lastRefreshedAt,
  onSendBatch, sending,
  onTogglePause, togglingPause,
  onRefresh, onToast,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleSendTest = async () => {
    if (!campaign) return;
    setSendingTest(true);
    try {
      await sendTestEmail(campaign.id, "elanromo90@gmail.com");
      onToast?.("Test email sent to elanromo90@gmail.com");
    } catch (err) {
      onToast?.((err as Error).message);
    } finally {
      setSendingTest(false);
    }
  };

  if (!campaign) {
    return (
      <section className="card campaign-detail">
        <div className="empty-state">Select a campaign to see leads</div>
      </section>
    );
  }

  const openedCount = rows.filter((r) => r.opened_at).length;
  const clickedCount = rows.filter((r) => r.clicked_at).length;
  const sentCount = rows.filter((r) => r.status === "sent").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const queuedCount = rows.filter((r) => r.status === "queued").length;

  return (
    <section className="card campaign-detail">
      <div className="detail-header">
        <div>
          <h2>
            <span className="detail-num">#{campaign.number}</span> {campaign.name}
          </h2>
          <div className="detail-meta-pills">
            <span className="meta-pill">{queuedCount} queued</span>
            <span className="meta-pill meta-pill-sent">{sentCount} sent</span>
            <span className="meta-pill meta-pill-open">{openedCount} opened ({fmtPercent(campaign.open_rate)})</span>
            <span className="meta-pill meta-pill-click">{clickedCount} clicked website ({fmtPercent(campaign.click_rate)})</span>
            {failedCount > 0 ? (
              <span className="meta-pill meta-pill-fail">{failedCount} failed</span>
            ) : null}
          </div>
        </div>
        <div className="detail-actions">
          <div className="detail-action-row">
            {onSendBatch && campaign.status === "active" ? (
              <button
                type="button"
                className="primary-btn"
                onClick={onSendBatch}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <span className="spinner spinner-inline" aria-hidden />
                    Sending
                  </>
                ) : (
                  "Send next 50"
                )}
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowEdit(true)}
            >
              Edit template
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={handleSendTest}
              disabled={sendingTest}
            >
              {sendingTest ? "Sending test" : "Send test email"}
            </button>
            {onTogglePause ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={onTogglePause}
                disabled={togglingPause}
              >
                {togglingPause ? "Updating" : campaign.status === "paused" ? "Resume campaign" : "Pause campaign"}
              </button>
            ) : null}
          </div>
          <div className="detail-refresh">
            {loading ? (
              <>
                <span className="spinner spinner-inline" aria-hidden />
                <span>Updating</span>
              </>
            ) : lastRefreshedAt ? (
              `Updated ${fmtDate(lastRefreshedAt.toISOString())}`
            ) : (
              ""
            )}
          </div>
        </div>
      </div>

      <div className="detail-table-wrap">
        {loading ? (
          <div className="table-loading-overlay" role="status" aria-live="polite">
            <span className="spinner" aria-hidden />
            <span>Updating leads</span>
          </div>
        ) : null}
        <table className="detail-table">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Club</th>
              <th>Grad</th>
              <th>GPA</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Clicked</th>
              <th>Sent at</th>
              <th>Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="table-empty">
                  No sends yet
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const isOpen = expandedId === r.send_id;
              return (
                <Fragment key={r.send_id}>
                  <tr
                    className={`row ${isOpen ? "expanded" : ""}`}
                    onClick={() => setExpandedId(isOpen ? null : r.send_id)}
                  >
                    <td className="chev">{isOpen ? "v" : ">"}</td>
                    <td className="cell-name">{r.full_name || `${r.first_name} ${r.last_name}`.trim()}</td>
                    <td>{r.club || ""}</td>
                    <td>{r.grad_year ?? ""}</td>
                    <td>{fmtGpa(r.gpa)}</td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status}</span>
                    </td>
                    <td>
                      {r.opened_at ? (
                        <span className="badge opened">{fmtDate(r.opened_at)}</span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>
                      {r.clicked_at ? (
                        <span className="badge clicked">{fmtDate(r.clicked_at)}</span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>{fmtDate(r.sent_at)}</td>
                    <td>{fmtDate(r.scheduled_at)}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="expand-row">
                      <td colSpan={10}>
                        <div className="expand-grid">
                          <div className="expand-meta">
                            <p>
                              <strong>Full name</strong>
                              <span>{r.full_name}</span>
                            </p>
                            <p>
                              <strong>Email</strong>
                              <span>{r.email}</span>
                            </p>
                            <p>
                              <strong>Phone</strong>
                              <span>{r.phone || ""}</span>
                            </p>
                            <p>
                              <strong>League</strong>
                              <span>{r.league || ""}</span>
                            </p>
                            <p>
                              <strong>Age group</strong>
                              <span>{r.age_group || ""}</span>
                            </p>
                            <p>
                              <strong>Positions</strong>
                              <span>{r.positions || ""}</span>
                            </p>
                            <p>
                              <strong>Email engagement</strong>
                              <span>
                                {r.opened_at
                                  ? `Opened ${fmtDate(r.opened_at)} (${r.open_count}x)`
                                  : "Not opened"}
                              </span>
                            </p>
                            <p>
                              <strong>Website click</strong>
                              <span>
                                {r.clicked_at
                                  ? `Clicked ${fmtDate(r.clicked_at)} (${r.click_count}x)`
                                  : "Not clicked"}
                              </span>
                            </p>
                          </div>
                          <div className="expand-email">
                            <p className="expand-subject">{r.subject}</p>
                            <div className="email-preview">
                              <img src={FV_LOGO_URL} width="80" height="80" alt="FieldVision" className="email-logo" />
                              <pre className="expand-body">{r.body}</pre>
                              <img src={FV_LOGO_URL} width="56" height="56" alt="FieldVision" className="email-logo email-logo-sig" />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showEdit ? (
        <EditCampaign
          campaignId={campaign.id}
          onClose={() => setShowEdit(false)}
          onSaved={() => { onRefresh?.(); }}
          onToast={(msg) => { onToast?.(msg); }}
        />
      ) : null}
    </section>
  );
}
