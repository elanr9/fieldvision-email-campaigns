import { useState, type FormEvent } from "react";

const AUTH_EMAIL = (import.meta.env.VITE_AUTH_EMAIL ?? "").trim().toLowerCase();
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD ?? "";

type Props = {
  onSuccess: () => void;
};

export default function Login({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!AUTH_EMAIL || !AUTH_PASSWORD) {
      setError("Auth not configured. Set VITE_AUTH_EMAIL and VITE_AUTH_PASSWORD.");
      return;
    }
    setSubmitting(true);
    const ok =
      email.trim().toLowerCase() === AUTH_EMAIL && password === AUTH_PASSWORD;
    if (!ok) {
      setError("Invalid email or password");
      setSubmitting(false);
      return;
    }
    setError(null);
    onSuccess();
  };

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img src="/fv-logo.png" alt="FieldVision" className="auth-logo" />
        <h1 className="auth-title">FieldVision Cold Email CRM</h1>
        <p className="auth-sub">Sign in to continue</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-btn full" type="submit" disabled={submitting}>
          {submitting ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
