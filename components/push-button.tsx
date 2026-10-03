"use client";

// Attiva le notifiche push su questo dispositivo (telefono o computer).
import { useEffect, useState } from "react";
import { api } from "@/components/client-utils";
import { btn } from "@/components/ui";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "ios-install" | "off" | "on" | "denied";

export default function PushButton() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    }
    check().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/app/push");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
      await api("/api/app/push", { body: sub.toJSON() });
      setState("on");
    } catch (err) {
      setError((err as Error).message || "Non sono riuscito ad attivare le notifiche.");
    }
  }

  if (state === "loading") return null;
  if (state === "on") return <span className="text-xs text-emerald-300">🔔 Notifiche attive su questo dispositivo</span>;
  if (state === "denied") return <span className="text-xs text-zinc-500">Notifiche bloccate: riattivale dalle impostazioni del browser.</span>;
  if (state === "ios-install")
    return <span className="text-xs text-zinc-400">📱 Su iPhone: tocca Condividi → &quot;Aggiungi alla schermata Home&quot;, apri Yeppo da lì e attiva le notifiche.</span>;
  if (state === "unsupported") return <span className="text-xs text-zinc-500">Questo browser non supporta le notifiche.</span>;
  return (
    <div>
      <button className={btn.secondary} onClick={enable}>🔔 Attiva notifiche sul telefono</button>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
