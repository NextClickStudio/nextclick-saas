"use client";

import { useEffect, useState } from "react";
import { randomLook, type Look } from "@/lib/avatar";
import { confetti, sfx } from "@/lib/fx";
import { useApp } from "./AppProvider";
import Creator from "./Creator";

/** First visit: build your trencher and pick a name. No email, no wallet. */
export default function Onboarding() {
  const { creating, openCreator, signup, login, session } = useApp();
  const [look, setLook] = useState<Look>(() => randomLook(1));
  const [handle, setHandle] = useState("");
  const [mode, setMode] = useState<"new" | "key">("new");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setLook(randomLook()), []);
  useEffect(() => {
    if (session) openCreator(false);
  }, [session, openCreator]);

  if (!creating) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "new") await signup(handle.trim(), look);
      else await login(key);
      sfx.win();
      confetti();
      openCreator(false);
    } catch (x) {
      sfx.error();
      setErr(x instanceof Error ? x.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={() => openCreator(false)}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2 className="display">{mode === "new" ? "Create your profile" : "Log in with your key"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => openCreator(false)}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {mode === "new" ? (
            <>
              <Creator look={look} onChange={setLook} size={132} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 18 }}>
                <input
                  className="input"
                  placeholder="Your name (3-16 letters, numbers or _)"
                  value={handle}
                  maxLength={16}
                  autoFocus
                  onChange={(e) => setHandle(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                />
                <button className="btn btn-primary" disabled={busy || handle.trim().length < 3}>
                  {busy ? "…" : "Create profile"}
                </button>
              </div>
              <p className="muted small" style={{ marginTop: 10 }}>
                No email, no wallet. Every duel round starts with 10 play SOL. You can change your picture any time.
              </p>
            </>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <input className="input mono" placeholder="Paste your account key" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
              <button className="btn btn-primary" disabled={busy || key.trim().length < 20}>
                {busy ? "…" : "Log in"}
              </button>
            </div>
          )}
          {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setMode(mode === "new" ? "key" : "new")}>
            {mode === "new" ? "I already have an account key" : "Create a new profile instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
