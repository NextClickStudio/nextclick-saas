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
import { clock, usd } from "@/lib/format";
import { CANDLE_MS, type RoundCoin } from "@/lib/duel";

export type Mark = { t: number; k: number; who: "me" | "opp" };

const UP = "#10d48e";
const DOWN = "#f6465d";
const ME = "#f0b90b";
const OPP = "#b18cff";
const bucket = (t: number) => (Math.floor(t / CANDLE_MS) * (CANDLE_MS / 1000)) as UTCTimestamp;

/** Market cap candles (USD) of the round's coin, x axis = coin age. Both players' trades are marked. */
export default function DuelChart({ coin, version, marks, entryUsd }: { coin: RoundCoin; version: number; marks: Mark[]; entryUsd: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const shown = useRef<{ coin: RoundCoin | null; n: number }>({ coin: null, n: 0 });
  const entryLine = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8d929c", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "rgba(255,255,255,0.035)" }, horzLines: { color: "rgba(255,255,255,0.035)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.12, bottom: 0.2 } },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 6,
        barSpacing: 8,
        tickMarkFormatter: (t: Time) => clock(Number(t) * 1000),
      },
      crosshair: { mode: 0 },
      localization: { priceFormatter: (p: number) => (p < 0 ? "" : usd(p)), timeFormatter: (t: Time) => `age ${clock(Number(t) * 1000)}` },
    });
    candles.current = c.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "custom", formatter: (p: number) => (p < 0 ? "" : usd(p)), minMove: 0.01 },
    });
    vol.current = c.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
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
    const volOf = (d: (typeof data)[number]) => ({
      time: d.time as UTCTimestamp,
      value: d.buy + d.sell,
      color: d.buy >= d.sell ? "rgba(16,212,142,0.32)" : "rgba(246,70,93,0.32)",
    });
    if (shown.current.coin !== coin || data.length < shown.current.n) {
      cs.setData(data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      vs.setData(data.map(volOf));
      chart.current?.timeScale().scrollToRealTime();
    } else {
      for (let i = Math.max(0, shown.current.n - 1); i < data.length; i++) {
        const d = data[i];
        cs.update({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close });
        vs.update(volOf(d));
      }
    }
    shown.current = { coin, n: data.length };
  }, [coin, version]);

  useEffect(() => {
    const m: SeriesMarker<Time>[] = [];
    const first = coin.candles.find((c) => c.time * 1000 >= coin.off);
    if (coin.off > 0 && first) m.push({ time: first.time as UTCTimestamp, position: "aboveBar", shape: "circle", color: "#5c616b", text: "ROUND START" });
    for (const x of marks) {
      m.push({
        time: bucket(x.t),
        position: x.k === 1 ? "belowBar" : "aboveBar",
        shape: x.k === 1 ? "arrowUp" : "arrowDown",
        color: x.who === "me" ? ME : OPP,
        text: x.who === "me" ? "YOU" : "",
        size: x.who === "me" ? 1.4 : 0.9,
      });
    }
    m.sort((a, b) => Number(a.time) - Number(b.time));
    markers.current?.setMarkers(m);
  }, [marks, coin, version]);

  useEffect(() => {
    const cs = candles.current;
    if (!cs) return;
    if (entryLine.current) {
      cs.removePriceLine(entryLine.current);
      entryLine.current = null;
    }
    if (entryUsd) entryLine.current = cs.createPriceLine({ price: entryUsd, color: ME, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "YOUR ENTRY" });
  }, [entryUsd, coin]);

  return (
    <div className="chart-box">
      <div ref={box} className="chart-canvas" />
      {!coin.candles.length && <div className="chart-empty">Waiting for the first trades…</div>}
    </div>
  );
}
