import { useMemo, useState } from "react";
import { createCampaign } from "../lib/api";
import {
  FV_LOGO_URL,
  defaultBodyTemplate,
  defaultSubjectTemplate,
  renderEmail,
  templateForGradYear,
} from "../lib/personalize";

type Props = {
  onClose: () => void;
  onCreated: (campaignId: string) => void;
  onToast: (message: string) => void;
};

const GRAD_YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030];

const SAMPLE_LEAD = {
  first_name: "Alex",
  last_name: "Rivera",
  full_name: "Alex Rivera",
  grad_year: 2027,
  gpa: 3.6,
  club: "Dallas Texans",
  positions: "CAM",
};

export default function NewCampaign({ onClose, onCreated, onToast }: Props) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(defaultSubjectTemplate());
  const [body, setBody] = useState(defaultBodyTemplate());
  const [gradYears, setGradYears] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => renderEmail({ subject, body }, SAMPLE_LEAD),
    [subject, body]
  );

  const toggleYear = (year: number) => {
    setGradYears((prev) => {
      const next = prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year];
      if (next.length === 1) {
        const tpl = templateForGradYear(next[0]);
        if (tpl) {
          setSubject(tpl.subject);
          setBody(tpl.body);
        }
      }
      return next;
    });
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Campaign name is required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCampaign({
        name: name.trim(),
        subject_template: subject,
        body_template: body,
        lead_filter: gradYears.length ? { grad_years: gradYears } : undefined,
      });
      onToast(`#${result.number} queued. ${result.queued} emails`);
      onCreated(result.campaign_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Campaign</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-form">
            <label className="field">
              <span>Campaign name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring Outreach Wave 1"
              />
            </label>

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
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>

            <div className="field">
              <span>Grad year filter</span>
              <div className="checkbox-row">
                {GRAD_YEAR_OPTIONS.map((year) => (
                  <label key={year} className="checkbox">
                    <input
                      type="checkbox"
                      checked={gradYears.includes(year)}
                      onChange={() => toggleYear(year)}
                    />
                    <span>{year}</span>
                  </label>
                ))}
              </div>
              <small className="hint">
                Leave empty to include all leads.
              </small>
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "Queueing" : "Queue campaign"}
              </button>
            </div>
          </div>

          <div className="preview-pane">
            <p className="preview-label">Sample preview for Alex Rivera</p>
            <div className="preview-card">
              <p className="preview-subject">{preview.subject}</p>
              <div className="email-preview">
                <img src={FV_LOGO_URL} width="80" height="80" alt="FieldVision" className="email-logo" />
                <pre className="preview-body">{preview.body}</pre>
                <img src={FV_LOGO_URL} width="56" height="56" alt="FieldVision" className="email-logo email-logo-sig" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
