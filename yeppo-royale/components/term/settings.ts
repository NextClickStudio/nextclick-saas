"use client";

import { useCallback, useEffect, useState } from "react";
import { readLocal, writeLocal } from "@/lib/supabase";
import type { Priority } from "@/lib/jup";

export type Tf = "1s" | "5s" | "15s" | "1m" | "5m";
export const TF_MS: Record<Tf, number> = { "1s": 1000, "5s": 5000, "15s": 15_000, "1m": 60_000, "5m": 300_000 };

export type TermSettings = {
  buy: number[];
  sell: number[];
  slip: number;
  prio: Priority;
  tf: Tf;
  unit: "mc" | "price";
  confirmReal: boolean;
};

const DEFAULTS: TermSettings = { buy: [0.1, 0.25, 0.5, 1], sell: [25, 50, 75, 100], slip: 15, prio: "turbo", tf: "5s", unit: "mc", confirmReal: true };

/** terminal preferences, kept on this device */
export function useTermSettings() {
  const [s, setS] = useState<TermSettings>(DEFAULTS);
  useEffect(() => {
    const saved = readLocal<Partial<TermSettings>>("yr:term", {});
    setS({ ...DEFAULTS, ...saved, buy: (saved.buy ?? DEFAULTS.buy).slice(0, 4), sell: (saved.sell ?? DEFAULTS.sell).slice(0, 4) });
  }, []);
  const set = useCallback((patch: Partial<TermSettings>) => {
    setS((cur) => {
      const next = { ...cur, ...patch };
      writeLocal("yr:term", next);
      return next;
    });
  }, []);
  return [s, set] as const;
}
