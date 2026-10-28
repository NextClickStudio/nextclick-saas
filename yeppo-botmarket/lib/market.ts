// Live market data from Binance public endpoints (free, CORS-enabled, no key).
import { useSyncExternalStore } from "react";
import { ASSETS, parseKlines, type Asset, type Candle, type Timeframe } from "./strategy";

const REST = "https://data-api.binance.vision/api/v3";
const WS = "wss://data-stream.binance.vision/stream";

export const ASSET_LIST = Object.keys(ASSETS) as Asset[];

export async function fetchKlines(asset: Asset, tf: Timeframe, limit = 500): Promise<Candle[]> {
  const res = await fetch(`${REST}/klines?symbol=${ASSETS[asset]}&interval=${tf}&limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  return parseKlines(await res.json());
}

export type Ticker = { price: number; open: number; chg: number; at: number };
type KlineListener = (c: Candle, final: boolean) => void;

const SYMBOL_TO_ASSET = Object.fromEntries(Object.entries(ASSETS).map(([a, s]) => [s, a as Asset]));

class MarketStream {
  private ws: WebSocket | null = null;
  private retry = 1000;
  private seq = 1;
  private prices: Partial<Record<Asset, Ticker>> = {};
  private listeners = new Set<() => void>();
  private klines = new Map<string, Set<KlineListener>>();
  private pending = false;
  private started = false;

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.open();
  }

  private open() {
    const streams = ASSET_LIST.map((a) => `${ASSETS[a].toLowerCase()}@miniTicker`).join("/");
    const ws = new WebSocket(`${WS}?streams=${streams}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      const keys = [...this.klines.keys()];
      if (keys.length) ws.send(JSON.stringify({ method: "SUBSCRIBE", params: keys, id: this.seq++ }));
    };
    ws.onmessage = (e) => {
      let msg: { stream?: string; data?: Record<string, unknown> };
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const d = msg.data;
      if (!d || !msg.stream) return;
      if (d.e === "24hrMiniTicker") {
        const asset = SYMBOL_TO_ASSET[String(d.s)];
        if (!asset) return;
        const price = Number(d.c);
        const open = Number(d.o);
        this.prices = { ...this.prices, [asset]: { price, open, chg: open ? (price / open - 1) * 100 : 0, at: Date.now() } };
        this.notify();
      } else if (d.e === "kline") {
        const k = d.k as Record<string, unknown>;
        const c: Candle = { t: Number(k.t), o: Number(k.o), h: Number(k.h), l: Number(k.l), c: Number(k.c), v: Number(k.v), T: Number(k.T) };
        this.klines.get(msg.stream)?.forEach((fn) => fn(c, Boolean(k.x)));
        const asset = SYMBOL_TO_ASSET[String(k.s)];
        if (asset) {
          const prev = this.prices[asset];
          this.prices = { ...this.prices, [asset]: { price: c.c, open: prev?.open ?? c.o, chg: prev?.open ? (c.c / prev.open - 1) * 100 : 0, at: Date.now() } };
          this.notify();
        }
      }
    };
    ws.onclose = () => {
      this.ws = null;
      setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 30_000);
    };
    ws.onerror = () => ws.close();
  }

  // batch React updates to ~4/s: miniTickers arrive every second per asset
  private notify() {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.listeners.forEach((fn) => fn());
    }, 250);
  }

  subscribe = (fn: () => void) => {
    this.start();
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  snapshot = () => this.prices;

  subscribeKline(asset: Asset, tf: Timeframe, fn: KlineListener) {
    this.start();
    const key = `${ASSETS[asset].toLowerCase()}@kline_${tf}`;
    let set = this.klines.get(key);
    if (!set) {
      set = new Set();
      this.klines.set(key, set);
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ method: "SUBSCRIBE", params: [key], id: this.seq++ }));
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (!set!.size) {
        this.klines.delete(key);
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: [key], id: this.seq++ }));
      }
    };
  }
}

export const market = new MarketStream();

const EMPTY: Partial<Record<Asset, Ticker>> = {};

export function usePrices() {
  return useSyncExternalStore(market.subscribe, market.snapshot, () => EMPTY);
}
