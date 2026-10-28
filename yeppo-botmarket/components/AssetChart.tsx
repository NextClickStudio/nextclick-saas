"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import { fetchKlines, market } from "@/lib/market";
import { assetPrice } from "@/lib/format";
import { mono } from "@/lib/fonts";
import { TF_MS, type Asset, type Candle, type Side, type Timeframe } from "@/lib/strategy";

export type Mark = { time: number; kind: "entry" | "exit"; side: Side; win?: boolean; text?: string };
export type Line = { price: number; color: string; title: string };

type Props = {
  asset: Asset;
  tf: Timeframe;
  candles?: Candle[];
  marks?: Mark[];
  lines?: Line[];
  className?: string;
};

const UP = "#00e38c";
const DOWN = "#ff3d57";
// lightweight-charts renders UTC: shift so the axis shows local time
const TZ = typeof window === "undefined" ? 0 : -new Date().getTimezoneOffset() * 60;
const toTime = (ms: number) => (Math.floor(ms / 1000) + TZ) as UTCTimestamp;

export default function AssetChart({ asset, tf, candles, marks = [], lines = [], className = "" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLines = useRef<IPriceLine[]>([]);
  const times = useRef<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let dead = false;
    import("lightweight-charts").then((lc) => {
      if (dead || !host.current) return;
      const c = lc.createChart(host.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#5f6168",
          fontFamily: mono.style.fontFamily,
          fontSize: 10,
          attributionLogo: false,
        },
        grid: { vertLines: { color: "rgba(255,255,255,0.025)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.2 } },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7 },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(255,255,255,0.18)", labelBackgroundColor: "#1a1b1f", width: 1 },
          horzLine: { color: "rgba(255,255,255,0.18)", labelBackgroundColor: "#1a1b1f", width: 1 },
        },
        localization: { priceFormatter: (p: number) => assetPrice(p) },
      });
      series.current = c.addSeries(lc.CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderVisible: false,
        wickUpColor: UP,
        wickDownColor: DOWN,
        priceLineColor: "rgba(255,255,255,0.35)",
        priceLineStyle: lc.LineStyle.Dotted,
        priceFormat: { type: "custom", minMove: 1e-10, formatter: (p: number) => assetPrice(p) },
      });
      volume.current = c.addSeries(lc.HistogramSeries, {
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      markers.current = lc.createSeriesMarkers(series.current, []);
      chart.current = c;
      setReady(true);
    });
    return () => {
      dead = true;
      chart.current?.remove();
      chart.current = null;
      series.current = null;
      volume.current = null;
      markers.current = null;
      priceLines.current = [];
    };
  }, []);

  // data: static candles (backtests) or live Binance klines
  useEffect(() => {
    if (!ready || !series.current || !volume.current) return;
    const s = series.current;
    const v = volume.current;
    let dead = false;
    const apply = (cs: Candle[]) => {
      times.current = new Set(cs.map((k) => toTime(k.t)));
      s.setData(cs.map((k) => ({ time: toTime(k.t), open: k.o, high: k.h, low: k.l, close: k.c })));
      v.setData(cs.map((k) => ({ time: toTime(k.t), value: k.v, color: k.c >= k.o ? "rgba(0,227,140,0.22)" : "rgba(255,61,87,0.22)" })));
      if (cs.length > 10) chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, cs.length - 140), to: cs.length + 6 });
      setLoading(false);
      setVersion((x) => x + 1);
    };
    if (candles) {
      apply(candles);
      return;
    }
    setLoading(true);
    fetchKlines(asset, tf, 500)
      .then((cs) => !dead && apply(cs))
      .catch(() => !dead && setLoading(false));
    const off = market.subscribeKline(asset, tf, (k) => {
      if (dead) return;
      const time = toTime(k.t);
      try {
        s.update({ time, open: k.o, high: k.h, low: k.l, close: k.c });
        v.update({ time, value: k.v, color: k.c >= k.o ? "rgba(0,227,140,0.22)" : "rgba(255,61,87,0.22)" });
        if (!times.current.has(time)) {
          times.current.add(time);
          setVersion((x) => x + 1);
        }
      } catch {
        /* tick older than the last bar */
      }
    });
    return () => {
      dead = true;
      off();
    };
  }, [ready, asset, tf, candles]);

  // trade markers, snapped to the candle they happened in
  useEffect(() => {
    const api = markers.current;
    if (!api) return;
    const step = TF_MS[tf];
    const out = marks
      .map((m) => ({ ...m, at: toTime(Math.floor(m.time / step) * step) }))
      .filter((m) => times.current.has(m.at))
      .sort((a, b) => a.at - b.at)
      .map((m): SeriesMarker<Time> => {
        if (m.kind === "entry") {
          return m.side === "long"
            ? { time: m.at, position: "belowBar", color: UP, shape: "arrowUp", text: m.text ?? "L" }
            : { time: m.at, position: "aboveBar", color: DOWN, shape: "arrowDown", text: m.text ?? "S" };
        }
        return { time: m.at, position: m.side === "long" ? "aboveBar" : "belowBar", color: m.win ? UP : DOWN, shape: "circle", text: m.text ?? "" };
      });
    api.setMarkers(out);
  }, [marks, tf, version]);

  // entry / target / stop lines
  const linesKey = lines.map((l) => `${l.title}:${l.price}`).join("|");
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    priceLines.current.forEach((l) => s.removePriceLine(l));
    priceLines.current = lines.map((l) =>
      s.createPriceLine({ price: l.price, color: l.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: l.title }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, ready]);

  return (
    <div className={`chart ${className}`}>
      <div ref={host} className="chart-canvas" />
      {loading && (
        <div className="chart-msg">
          <i className="spinner" />
        </div>
      )}
    </div>
  );
}
