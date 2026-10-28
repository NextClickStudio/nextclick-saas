"use client";

import { useEffect, useState } from "react";
import { confetti, sfx, toast } from "@/lib/fx";
import { useApp } from "./AppProvider";

export default function AuthModal() {
  const { auth, openAuth, signup, login } = useApp();
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue("");
    setErr(null);
    setBusy(false);
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openAuth(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auth, openAuth]);

  if (!auth) return null;
  const isSignup = auth === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (isSignup) {
        await signup(value.trim());
        sfx.win();
        confetti();
        toast("Welcome to Botmarket. 10,000 pts added.", "gold");
      } else {
        await login(value);
        sfx.coin();
        toast("Welcome back", "up");
      }
      openAuth(null);
    } catch (x) {
      sfx.error();
      setErr(x instanceof Error ? x.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={() => openAuth(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="lbl">{isSignup ? "Create account" : "Log in"}</span>
          <button className="icon-btn" onClick={() => openAuth(null)} aria-label="Close">
            ×
          </button>
        </div>
        <h2 id="auth-title">{isSignup ? "Pick a handle, get 10,000 pts" : "Paste your account key"}</h2>
        <p className="muted">
          {isSignup
            ? "No email, no wallet. Points are free and can't be bought — use them to back the best bots."
            : "Your key is in Portfolio → Account on the device you signed up with."}
        </p>
        <form onSubmit={submit} className="form">
          <input
            autoFocus
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isSignup ? "handle" : "account key"}
            maxLength={isSignup ? 16 : 80}
            spellCheck={false}
            autoComplete="off"
            aria-label={isSignup ? "Handle" : "Account key"}
          />
          <button className="btn btn-primary btn-lg" disabled={busy || value.trim().length < 3}>
            {busy ? "…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>
        {err && <div className="form-err">{err}</div>}
        <button className="link" onClick={() => openAuth(isSignup ? "login" : "signup")}>
          {isSignup ? "Already have an account? Log in with your key" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
