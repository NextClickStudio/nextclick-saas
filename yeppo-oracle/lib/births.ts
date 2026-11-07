"use client";

// Coins launched on pump.fun this second, from PumpPortal's free launch feed, in the viewer's own browser: an open
// wave shows a new coin with its word the moment it launches, and the radar matches it against posts, before yeppo's
// database has it. One connection for the whole page (PumpPortal asks for one per client), open only while a wave or
// the radar is open.
import { useEffect, useState } from "react";

/** a launch as PumpPortal announces it: the creator, the creator's own buy in the launch transaction (tokens) and the
 *  curve right after it (virtual tokens left), so the first seconds can be read from the curve */
export type Birth = { mint: string; sym: string | null; name: string | null; t: number; mcSol: number | null; dev: string | null; devBuy: number; vtok0: number | null; uri: string | null; pump: boolean };

const WS = "wss://pumpportal.fun/api/data";
const KEEP_MS = 20 * 60_000;

let ws: WebSocket | null = null;
let retry = 0;
const recent: Birth[] = [];
const listeners = new Set<() => void>();

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null);

function connect() {
  if (ws || !listeners.size) return;
  const sock = new WebSocket(WS);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    sock.send(JSON.stringify({ method: "subscribeNewToken" }));
  };
  sock.onmessage = (m) => {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (d.txType !== "create" || typeof d.mint !== "string") return;
    const now = Date.now();
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    recent.unshift({
      mint: d.mint, sym: str(d.symbol), name: str(d.name), t: now, mcSol: num(d.marketCapSol), dev: str(d.traderPublicKey),
      devBuy: num(d.initialBuy) ?? 0, vtok0: num(d.vTokensInBondingCurve), uri: typeof d.uri === "string" ? d.uri.slice(0, 300) : null,
      pump: d.pool === "pump" || d.pool === undefined,
    });
    while (recent.length && now - recent[recent.length - 1].t > KEEP_MS) recent.pop();
    if (recent.length > 2000) recent.length = 2000;
    for (const f of listeners) f();
  };
  sock.onclose = () => {
    ws = null;
    if (listeners.size) setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));
  };
  sock.onerror = () => sock.close();
}

const words = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/);

/** coins with `theme` as a word of their name or ticker, launched since this page started listening, newest first */
export function useBirths(theme: string | null): Birth[] {
  const [list, setList] = useState<Birth[]>([]);
  useEffect(() => {
    setList([]);
    if (!theme) return;
    const pick = () => setList(recent.filter((b) => words(b.sym).includes(theme) || words(b.name).includes(theme)).slice(0, 20));
    listeners.add(pick);
    connect();
    pick();
    return () => {
      listeners.delete(pick);
      if (!listeners.size) ws?.close();
    };
  }, [theme]);
  return list;
}

/** every launch since this page started listening (newest first), while `on`: refreshed at most every 2 seconds */
export function useLaunches(on: boolean): Birth[] {
  const [list, setList] = useState<Birth[]>([]);
  useEffect(() => {
    if (!on) return;
    let due = false;
    const pick = () => {
      if (due) return;
      due = true;
      setTimeout(() => {
        due = false;
        setList(recent.slice());
      }, 2000);
    };
    listeners.add(pick);
    connect();
    setList(recent.slice());
    return () => {
      listeners.delete(pick);
      if (!listeners.size) ws?.close();
    };
  }, [on]);
  return list;
}
