"use client";

import { useEffect, useState } from "react";
import { readFlag, setFlag } from "./prefs";

const KEY = "scopo:install-dismissed";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * Invito a installare la web app:
 * - iPhone/iPad (Safari): spiega "Condividi → Aggiungi a Home";
 * - Android/Chrome: usa il prompt nativo di installazione.
 */
export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "prompt" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readFlag(KEY)) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    if (isIos) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;

  function dismiss() {
    setFlag(KEY);
    setMode(null);
  }

  return (
    <div className="install" role="region" aria-label="Install Scopo">
      <div className="install-icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="install-text">
        <strong>Install Scopo</strong>
        {mode === "ios" ? (
          <span>
            Tap{" "}
            <svg className="ios-share" viewBox="0 0 24 24" width="16" height="16" aria-label="Share">
              <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{" "}
            then <b>Add to Home Screen</b> for the full-screen app.
          </span>
        ) : (
          <span>Add it to your home screen and open it like an app.</span>
        )}
      </div>
      {mode === "prompt" && deferred && (
        <button
          type="button"
          className="btn btn-volt btn-sm"
          onClick={async () => {
            await deferred.prompt();
            dismiss();
          }}
        >
          Install
        </button>
      )}
      <button type="button" className="install-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
