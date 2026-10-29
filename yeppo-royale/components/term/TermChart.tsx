"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { usd } from "@/lib/format";
import { type Coin, solPrice, SUPPLY } from "@/lib/pump";
import { TF_MS, type Tf } from "./settings";

export type ChartMark = { t: number; k: 1 | 2; who: "me" | "opp" };

const UP = "#10d48e";
const DOWN = "#f6465d";
const ME = "#f0b90b";
const OPP = "#b18cff";

/** $0.0₅4512 style prices for coins worth a fraction of a cent */
export function tinyUsd(p: number) {
  if (!(p > 0)) return "";
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  const s = p.toExponential(3);
  const [m, e] = s.split("e-");
  const zeros = Number(e) - 1;
  const digits = m.replace(".", "").slice(0, 4);
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[+d])
    .join("");
  return `$0.0${sub}${digits}`;
}

type C = { time: UTCTimestamp; open: number; high: number; low: number; close: number; vb: number; vs: number };

function build(coin: Coin, tf: Tf, unit: "mc" | "price"): C[] {
  const ms = TF_MS[tf];
  const su = solPrice();
  const k = unit === "mc" ? SUPPLY * su : su;
  const out: C[] = [];
  let last: C | null = null;
  for (const tr of coin.trades) {
    const v = (tr.vsol / tr.vtok) * k;
    if (!(v > 0)) continue;
    const time = (Math.floor(tr.t / ms) * (ms / 1000)) as UTCTimestamp;
    if (last && last.time === time) {
      last.high = Math.max(last.high, v);
      last.low = Math.min(last.low, v);
      last.close = v;
      if (tr.k === 1) last.vb += tr.sol;
      else last.vs += tr.sol;
    } else {
      const open: number = last ? last.close : v;
      last = { time, open, high: Math.max(open, v), low: Math.min(open, v), close: v, vb: tr.k === 1 ? tr.sol : 0, vs: tr.k === 2 ? tr.sol : 0 };
      out.push(last);
    }
  }
  return out;
}

/** candles of the selected coin in real time, with every trade of both duelists pinned on it */
export default function TermChart({
  coin,
  version,
  tf,
  unit,
  marks,
  entry,
}: {
  coin: Coin;
  version: number;
  tf: Tf;
  unit: "mc" | "price";
  marks: ChartMark[];
  /** average entry price in SOL per token */
  entry: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const line = useRef<IPriceLine | null>(null);
  const shown = useRef<{ key: string; n: number; first: number }>({ key: "", n: 0, first: 0 });
  const unitRef = useRef(unit);
  unitRef.current = unit;

  useEffect(() => {
    if (!box.current) return;
    const fmt = (p: number) => (p < 0 ? "" : unitRef.current === "mc" ? usd(p) : tinyUsd(p));
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8d929c", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.07)", scaleMargins: { top: 0.1, bottom: 0.22 } },
      timeScale: { borderColor: "rgba(255,255,255,0.07)", timeVisible: true, secondsVisible: true, rightOffset: 8, barSpacing: 7, minBarSpacing: 1.5, maxBarSpacing: 16 },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: fmt },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "custom", formatter: fmt, minMove: 1e-12 },
    });
    vol.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    markers.current = createSeriesMarkers(candles.current, []);
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
    };
  }, []);

  // candles: full redraw on a new coin / timeframe / unit, else only the tail moves
  useEffect(() => {
    const cs = candles.current;
    const vs = vol.current;
    if (!cs || !vs) return;
    const data = build(coin, tf, unit);
    const key = `${coin.mint}:${tf}:${unit}`;
    const v = (d: C) => ({ time: d.time, value: d.vb + d.vs, color: d.vb >= d.vs ? "rgba(16,212,142,0.3)" : "rgba(246,70,93,0.3)" });
    const s = shown.current;
    if (s.key !== key || data.length < s.n || (data[0]?.time ?? 0) !== s.first) {
      cs.setData(data.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
      vs.setData(data.map(v));
      // a new coin, or the history just arrived after a few live trades: frame the latest candles
      if (s.key !== key || s.n < 30) {
        const n = data.length;
        if (n > 120) chart.current?.timeScale().setVisibleLogicalRange({ from: n - 120, to: n + 6 });
        else {
          chart.current?.timeScale().applyOptions({ barSpacing: 9 });
          chart.current?.timeScale().scrollToRealTime();
        }
      }
    } else {
      for (let i = Math.max(0, s.n - 1); i < data.length; i++) {
        const d = data[i];
        cs.update({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close });
        vs.update(v(d));
      }
    }
    shown.current = { key, n: data.length, first: data[0]?.time ?? 0 };
  }, [coin, version, tf, unit]);

  useEffect(() => {
    const ms = TF_MS[tf];
    const m: SeriesMarker<Time>[] = marks
      .map((x) => ({
        time: (Math.floor(x.t / ms) * (ms / 1000)) as UTCTimestamp,
        position: x.k === 1 ? ("belowBar" as const) : ("aboveBar" as const),
        shape: x.k === 1 ? ("arrowUp" as const) : ("arrowDown" as const),
        color: x.who === "me" ? ME : OPP,
        text: x.who === "me" ? (x.k === 1 ? "B" : "S") : "",
        size: x.who === "me" ? 1.3 : 0.9,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));
    markers.current?.setMarkers(m);
  }, [marks, tf, coin, version]);

  useEffect(() => {
    const cs = candles.current;
    if (!cs) return;
    if (line.current) {
      cs.removePriceLine(line.current);
      line.current = null;
    }
    if (entry && entry > 0) {
      const p = entry * (unit === "mc" ? SUPPLY : 1) * solPrice();
      line.current = cs.createPriceLine({ price: p, color: ME, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "AVG ENTRY" });
    }
  }, [entry, coin, unit]);

  return (
    <div className="tchart">
      <div ref={box} className="tchart-canvas" />
      {!coin.trades.length && <div className="chart-empty">{coin.loaded === "loading" ? "Loading the chart…" : "Waiting for the first trades…"}</div>}
    </div>
  );
}
