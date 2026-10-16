"use client";

import { useEffect } from "react";

/** Service worker minimo: mostra una pagina "sei offline" quando manca la rete. */
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // non critico
    });
  }, []);
  return null;
}
