import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  gateError: string | null;
};

export default function Login({ gateError }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const google = async () => {
    setError(null);
    setSubmitting(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setSubmitting(false);
    }
  };

  const combined = gateError ?? error;

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <img src="/fv-logo.png" alt="FieldVision" className="auth-logo" />
        <h1 className="auth-title">FieldVision Cold Email CRM</h1>
        <p className="auth-sub">Sign in with your Google account</p>

        {combined ? <p className="form-error">{combined}</p> : null}

        <button type="button" className="primary-btn full" onClick={google} disabled={submitting}>
          {submitting ? "Redirecting" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
