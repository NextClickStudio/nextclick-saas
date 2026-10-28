"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { usd } from "@/lib/format";
import type { CoinState } from "@/lib/coin";

/** Market cap candles (in USD) for one coin, with the player's own buys and sells marked. */
export default function CoinChart({
  coin,
  version,
  fills,
  entryUsd,
}: {
  coin: CoinState;
  version: number;
  fills: { ms: number; k: number }[];
  entryUsd: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const shown = useRef<{ ci: number; n: number }>({ ci: -1, n: 0 });
  const entryLine = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b90b3", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.1, bottom: 0.22 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: true, rightOffset: 4, barSpacing: 9 },
      crosshair: { mode: 0 },
      localization: { priceFormatter: (p: number) => usd(p) },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: "#2bff88",
      downColor: "#ff3b5c",
      borderUpColor: "#2bff88",
      borderDownColor: "#ff3b5c",
      wickUpColor: "#2bff88",
      wickDownColor: "#ff3b5c",
      priceFormat: { type: "custom", formatter: (p: number) => usd(p), minMove: 0.01 },
    });
    vol.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    markers.current = createSeriesMarkers(candles.current, []);
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const cs = candles.current;
    const vs = vol.current;
    if (!cs || !vs) return;
    const data = coin.candles;
    const fresh = shown.current.ci !== coin.ci;
    if (fresh || data.length < shown.current.n) {
      cs.setData(data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      vs.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.buy + d.sell, color: d.buy >= d.sell ? "rgba(43,255,136,0.35)" : "rgba(255,59,92,0.35)" })));
      chart.current?.timeScale().scrollToRealTime();
    } else {
      for (let i = Math.max(0, shown.current.n - 1); i < data.length; i++) {
        const d = data[i];
        cs.update({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close });
        vs.update({ time: d.time as UTCTimestamp, value: d.buy + d.sell, color: d.buy >= d.sell ? "rgba(43,255,136,0.35)" : "rgba(255,59,92,0.35)" });
      }
    }
    shown.current = { ci: coin.ci, n: data.length };
  }, [coin, version]);

  useEffect(() => {
    const m: SeriesMarker<Time>[] = fills.map((f) => ({
      time: (Math.floor(f.ms / 3000) * 3) as UTCTimestamp,
      position: f.k === 1 ? "belowBar" : "aboveBar",
      shape: f.k === 1 ? "arrowUp" : "arrowDown",
      color: f.k === 1 ? "#ffd400" : "#ff9bd0",
      text: f.k === 1 ? "BUY" : "SELL",
    }));
    m.sort((a, b) => Number(a.time) - Number(b.time));
    markers.current?.setMarkers(m);
  }, [fills, coin.ci]);

  useEffect(() => {
    const cs = candles.current;
    if (!cs) return;
    if (entryLine.current) {
      cs.removePriceLine(entryLine.current);
      entryLine.current = null;
    }
    if (entryUsd) entryLine.current = cs.createPriceLine({ price: entryUsd, color: "#ffd400", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "YOUR ENTRY" });
  }, [entryUsd, coin.ci]);

  return (
    <div className="chart-box">
      <div ref={box} className="chart-canvas" />
      {!coin.candles.length && <div className="chart-empty">Waiting for the first trades…</div>}
    </div>
  );
}
