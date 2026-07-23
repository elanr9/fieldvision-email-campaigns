import { useEffect, useMemo, useState } from "react";
import { getCampaignTemplate, updateCampaign, type CampaignTemplate } from "../lib/api";
import { FV_LOGO_URL, renderEmail } from "../lib/personalize";

type Props = {
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
};

const SAMPLE_LEAD = {
  first_name: "Alex",
  last_name: "Rivera",
  full_name: "Alex Rivera",
  grad_year: 2026,
  gpa: 3.6,
  club: "Dallas Texans",
  positions: "CAM",
};

export default function EditCampaign({ campaignId, onClose, onSaved, onToast }: Props) {
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCampaignTemplate(campaignId)
      .then((t) => {
        setTemplate(t);
        setSubject(t.subject_template);
        setBody(t.body_template);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const preview = useMemo(
    () => renderEmail({ subject, body }, SAMPLE_LEAD),
    [subject, body],
  );

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await updateCampaign(campaignId, subject, body);
      onToast(`Template saved. ${result.updated} queued emails updated.`);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit template{template ? ` — ${template.name}` : ""}</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <span className="spinner" aria-hidden />
            <span>Loading template</span>
          </div>
        ) : (
          <div className="modal-body">
            <div className="modal-form">
              <label className="field">
                <span>Subject template</span>
                <textarea
                  rows={2}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Body template</span>
                <textarea
                  rows={16}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              <p className="hint">
                Use {"{{"} first_name {"}}"}, {"{{"} club {"}}"}, {"{{"} grad_year {"}}"} as tokens. Changes re-render all queued emails.
              </p>

              {error ? <div className="form-error">{error}</div> : null}

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner spinner-inline" aria-hidden />
                      Saving
                    </>
                  ) : (
                    "Save and update emails"
                  )}
                </button>
              </div>
            </div>

            <div className="preview-pane">
              <p className="preview-label">Preview for Alex Rivera</p>
              <div className="preview-card">
                <p className="preview-subject">{preview.subject}</p>
                <pre className="preview-body">{preview.body}</pre>
                <div className="preview-cta">Start free-trial now →</div>
                <div className="preview-sig">
                  Whether you hop on or not, feel free to text/call me anytime about college soccer, my personal number's below.
                  <br /><br />
                  Have a great day Alex,<br />
                  <strong>Elan Romo</strong><br />
                  Co-founder &amp; CEO, FieldVision AI<br />
                  954-770-9208
                </div>
                <img src={FV_LOGO_URL} width="32" height="32" alt="FieldVision" className="email-logo-sig" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
