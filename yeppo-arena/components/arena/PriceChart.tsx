"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import { fetchCandles, type Coin } from "@/lib/market";
import { fmtPrice, fmtUsd } from "@/lib/format";
import { readLocal, writeLocal } from "@/lib/supabase";
import { mono } from "@/lib/fonts";

type Bar = { time: number; open: number; high: number; low: number; close: number };
type Mark = { time: number; side: "buy" | "sell" };
type Props = { coin: Coin | null; mint: string | null; marks: Mark[]; entry: number | null };

const TFS = [1, 5, 15] as const;
// lightweight-charts renders UTC: shift so the axis shows local time.
const TZ = typeof window === "undefined" ? 0 : -new Date().getTimezoneOffset() * 60;

const UP = "#c6ff1a";
const DOWN = "#ff2d75";

export default function PriceChart({ coin, mint, marks, entry }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const entryRef = useRef<IPriceLine | null>(null);
  const bars = useRef<Bar[]>([]);
  const coinRef = useRef(coin);
  const modeRef = useRef<"mc" | "price">("mc");
  const reqRef = useRef(0);
  coinRef.current = coin;

  const [ready, setReady] = useState(false);
  const [tf, setTf] = useState<number>(() => readLocal("yeppo:tf", 1));
  const [state, setState] = useState<"loading" | "ok" | "live-only">("loading");
  const [version, setVersion] = useState(0);

  // create the chart once
  useEffect(() => {
    let disposed = false;
    import("lightweight-charts").then((lc) => {
      if (disposed || !host.current) return;
      const chart = lc.createChart(host.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#6c6c82",
          fontFamily: mono.style.fontFamily,
          fontSize: 11,
          attributionLogo: false,
        },
        grid: { vertLines: { color: "rgba(255,255,255,0.025)" }, horzLines: { color: "rgba(255,255,255,0.035)" } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.14, bottom: 0.08 } },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 9 },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(198,255,26,0.35)", labelBackgroundColor: "#1d2408" },
          horzLine: { color: "rgba(198,255,26,0.35)", labelBackgroundColor: "#1d2408" },
        },
        localization: { priceFormatter: (p: number) => (modeRef.current === "mc" ? fmtUsd(p) : fmtPrice(p)) },
      });
      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderVisible: false,
        wickUpColor: UP,
        wickDownColor: DOWN,
        priceLineColor: "rgba(198,255,26,0.6)",
        priceLineStyle: lc.LineStyle.Dotted,
        priceFormat: { type: "custom", minMove: 1e-12, formatter: (p: number) => (modeRef.current === "mc" ? fmtUsd(p) : fmtPrice(p)) },
      });
      chartRef.current = chart;
      seriesRef.current = series;
      markersRef.current = lc.createSeriesMarkers(series, []);
      setReady(true);
    });
    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      entryRef.current = null;
    };
  }, []);

  const pair = coin?.pair ?? null;
  const hasCoin = !!coin;

  // load history when the coin / timeframe changes
  useEffect(() => {
    const series = seriesRef.current;
    if (!ready || !series) return;
    const req = ++reqRef.current;
    bars.current = [];
    series.setData([]);
    if (!mint || !hasCoin) {
      setState("loading");
      return;
    }
    setState("loading");
    (async () => {
      const raw = pair ? await fetchCandles(pair, tf) : [];
      if (req !== reqRef.current) return;
      const c = coinRef.current;
      const mult = c && c.supply > 0 ? c.supply : 1;
      modeRef.current = c && c.supply > 0 ? "mc" : "price";
      const data = raw.map((b) => ({
        time: b.time + TZ,
        open: b.open * mult,
        high: b.high * mult,
        low: b.low * mult,
        close: b.close * mult,
      }));
      bars.current = data;
      series.setData(data.map((b) => ({ ...b, time: b.time as UTCTimestamp })));
      if (data.length > 2) {
        chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 110), to: data.length + 8 });
      }
      setState(data.length > 2 ? "ok" : "live-only");
      setVersion((v) => v + 1);
    })();
  }, [ready, mint, pair, tf, hasCoin]);

  // stream the live price into the last candle
  const live = coin ? (coin.supply > 0 ? coin.mcapUsd : coin.priceUsd) : 0;
  const liveAt = coin?.at ?? 0;
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !(live > 0) || state === "loading") return;
    const step = tf * 60;
    const bucket = Math.floor(Date.now() / 1000 / step) * step + TZ;
    const last = bars.current[bars.current.length - 1];
    let bar: Bar;
    if (!last || bucket > last.time) {
      const open = last?.close ?? live;
      bar = { time: bucket, open, high: Math.max(open, live), low: Math.min(open, live), close: live };
      bars.current.push(bar);
    } else if (bucket === last.time) {
      bar = { ...last, high: Math.max(last.high, live), low: Math.min(last.low, live), close: live };
      bars.current[bars.current.length - 1] = bar;
    } else {
      return;
    }
    try {
      series.update({ ...bar, time: bar.time as UTCTimestamp });
    } catch {
      /* out-of-order tick */
    }
  }, [live, liveAt, tf, state]);

  // my buys / sells as markers
  useEffect(() => {
    const api = markersRef.current;
    if (!api) return;
    const step = tf * 60;
    const times = new Set(bars.current.map((b) => b.time));
    const out: SeriesMarker<Time>[] = marks
      .map((m) => ({ ...m, t: Math.floor(m.time / step) * step + TZ }))
      .filter((m) => times.has(m.t))
      .sort((a, b) => a.t - b.t)
      .map((m) =>
        m.side === "buy"
          ? { time: m.t as UTCTimestamp, position: "belowBar", color: UP, shape: "arrowUp", text: "B" }
          : { time: m.t as UTCTimestamp, position: "aboveBar", color: DOWN, shape: "arrowDown", text: "S" },
      );
    api.setMarkers(out);
  }, [marks, tf, version, liveAt]);

  // average entry line
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (entryRef.current) {
      series.removePriceLine(entryRef.current);
      entryRef.current = null;
    }
    if (entry && entry > 0) {
      entryRef.current = series.createPriceLine({
        price: entry,
        color: "#2ef2ff",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "ENTRY",
      });
    }
  }, [entry, ready, version]);

  return (
    <div className="chart">
      <div className="chart-bar">
        <div className="tfs">
          {TFS.map((t) => (
            <button
              key={t}
              className={t === tf ? "on" : ""}
              onClick={() => {
                setTf(t);
                writeLocal("yeppo:tf", t);
              }}
            >
              {t}m
            </button>
          ))}
        </div>
        <span className="chart-mode muted mono">{modeRef.current === "mc" ? "MARKET CAP · USD" : "PREZZO · USD"}</span>
      </div>
      <div className="chart-host">
        {coin && <div className="chart-watermark">${coin.symbol}</div>}
        <div ref={host} className="chart-canvas" />
        {mint && state === "loading" && (
          <div className="chart-msg">
            <i className="spinner" />
          </div>
        )}
        {state === "live-only" && <div className="chart-note mono">storico non disponibile · candele live</div>}
      </div>
    </div>
  );
}
