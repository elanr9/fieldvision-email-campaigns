import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import "./index.css";
import App from "./App.tsx";
import Login from "./components/Login.tsx";
import { supabase } from "./lib/supabase";

const ALLOWED_DOMAIN = (import.meta.env.VITE_ALLOWED_AUTH_DOMAIN ?? "").trim().toLowerCase();

function AuthGate() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    const validate = async (s: Session | null) => {
      setGateError(null);
      if (!s?.user?.email) {
        setSession(null);
        return;
      }
      if (ALLOWED_DOMAIN && !s.user.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
        await supabase.auth.signOut();
        setSession(null);
        setGateError(`Use your @${ALLOWED_DOMAIN} Google account.`);
        return;
      }
      setSession(s);
    };

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      void validate(initial);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void validate(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="auth-screen">
        <div className="loading-state" role="status" aria-live="polite">
          <span className="spinner" aria-hidden />
          <p className="loading-state-label">Signing you in</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return <Login gateError={gateError} />;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
