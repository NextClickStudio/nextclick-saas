"use client";

import { useEffect } from "react";

/**
 * Safari su iPhone ignora "user-scalable=no": blocco a mano il pizzico con due dita.
 * Lo scorrimento in su e in giù (un dito) resta normale.
 */
export default function NoZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const pinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("touchmove", pinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", pinch);
    };
  }, []);
  return null;
}
