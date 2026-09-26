"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cardWorth, GAME_CONFIG, sellPrice } from "@/config/game";
import { FAMILY_LABELS } from "@/lib/cards/families";
import { cardNumbers } from "@/lib/cards/view";
import { ago, cr, DOWN, num, pct, signed, signedPct, tone, UP, vibrate } from "@/lib/format";
import { trendCard, useGame } from "@/lib/game/store";
import type { OwnedCard, Trend } from "@/lib/game/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Chart } from "./Chart";
import { TrendCard } from "./TrendCard";

/** Full-screen detail of a trend: chart, your cards, buy / sell, today's call. */
export function TrendSheet() {
  const { sheet, closeSheet, market } = useGame();
  const trend = sheet ? market?.get(sheet.trendId) : undefined;

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheet, closeSheet]);

  return (
    <AnimatePresence>
      {sheet && trend && (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Body trend={trend} focusCard={sheet.cardId} onClose={closeSheet} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function dayLabels(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (i === 0) out.push("Now");
    else {
      const d = new Date(Date.now() - i * 86_400_000);
      out.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
  }
  return out;
}

function Body({ trend, focusCard, onClose }: { trend: Trend; focusCard?: string; onClose: () => void }) {
  const { state, buy, sell, call } = useGame();
  const [range, setRange] = useState<"7d" | "30d">("30d");
  const [week, setWeek] = useState<{ values: number[]; labels: string[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState("");

  const mine = useMemo(() => (state?.cards ?? []).filter((c) => c.trend_id === trend.id), [state, trend.id]);
  const focus = mine.find((c) => c.id === focusCard) ?? mine[0];
  const view = trendCard(trend, focus);
  const n = cardNumbers(view);
  const price = cardWorth(trend.value, "common");
  const credits = state?.house.credits ?? 0;
  const forecast = state?.forecast.find((f) => f.trend_id === trend.id);

  useEffect(() => {
    if (range !== "7d" || week) return;
    supabaseBrowser()
      .from("maison_trend_points")
      .select("ts, value")
      .eq("trend_id", trend.id)
      .gte("ts", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("ts")
      .then(({ data }) => {
        const rows = (data ?? []) as { ts: string; value: number }[];
        const values = rows.map((r) => Number(r.value));
        const labels = rows.map((r) => new Date(r.ts).toLocaleString("en-US", { weekday: "short", hour: "numeric" }));
        if (values[values.length - 1] !== trend.value) {
          values.push(trend.value);
          labels.push("Now");
        }
        setWeek({ values, labels });
      });
  }, [range, week, trend.id, trend.value]);

  const doBuy = async () => {
    setBusy("buy");
    setMsg("");
    const err = await buy(trend.id);
    setBusy("");
    if (err) return setMsg(err);
    vibrate(25);
    setMsg(`Bought ${trend.name} at ${trend.value.toFixed(1)}.`);
  };

  const doSell = async (c: OwnedCard) => {
    if (confirm !== c.id) {
      setConfirm(c.id);
      return;
    }
    setConfirm("");
    setBusy(c.id);
    const pay = sellPrice(trend.value, c.rarity);
    const err = await sell(c.id);
    setBusy("");
    if (err) return setMsg(err);
    vibrate([20, 30, 40]);
    setMsg(`Sold for ${cr(pay)}.`);
  };

  const doCall = async (dir: 1 | -1) => {
    setBusy("call");
    const err = await call(trend.id, dir);
    setBusy("");
    vibrate(20);
    if (err) setMsg(err);
  };

  const chart = range === "30d" ? { values: trend.history, labels: dayLabels(trend.history.length) } : week;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-[max(env(safe-area-inset-top),20px)] pb-40 sm:px-8">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-lg font-bold text-muted active:text-ivory">
          <span aria-hidden className="text-2xl leading-none">&lsaquo;</span> Back
        </button>
        <span className="eyebrow">{FAMILY_LABELS[trend.family]}</span>
      </div>

      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-start">
        <div className="mx-auto w-[64vw] max-w-[300px] md:mx-0 md:w-[300px]">
          <TrendCard card={view} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="headline text-5xl text-balance">{trend.name}</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="headline text-5xl tabular-nums">{trend.value.toFixed(1)}</span>
            <span className="mb-1 rounded-full bg-surface px-3 py-1.5 font-extrabold tabular-nums" style={{ color: tone(n.change) }}>
              {pct(n.change)} today
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-muted">
            {trend.listed ? `Updated ${ago(trend.updatedAt)} · ${trend.source === "sim" ? "estimated (low search volume)" : "Google search interest"}` : "Listing soon"}
          </p>

          <div className="mt-5 flex gap-2">
            {(["30d", "7d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${range === r ? "bg-ivory text-bg" : "bg-surface text-muted"}`}
              >
                {r === "30d" ? "30 days" : "7 days"}
              </button>
            ))}
          </div>
          <div className="mt-3">{chart ? <Chart values={chart.values} labels={chart.labels} /> : <div className="h-[210px] animate-pulse rounded-3xl bg-surface" />}</div>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            The price follows how much the world searches for <span className="font-bold text-ivory">{trend.name}</span> on Google. More searches in the last
            24 hours than the week&rsquo;s average push it up; fewer pull it down.
          </p>

          {/* Forecast call */}
          {forecast && (
            <div className="mt-5 rounded-3xl bg-surface p-5">
              <p className="eyebrow">In today&rsquo;s forecast</p>
              {forecast.dir ? (
                <p className="mt-2 text-lg font-extrabold">
                  You called it {forecast.dir === 1 ? "rising" : "falling"} at {Number(forecast.at).toFixed(1)}.{" "}
                  <span style={{ color: (trend.value - Number(forecast.at)) * forecast.dir >= 0 ? UP : DOWN }}>
                    {(trend.value - Number(forecast.at)) * forecast.dir >= 0 ? "Right so far." : "Wrong so far."}
                  </span>
                </p>
              ) : (
                <>
                  <p className="mt-2 text-lg font-extrabold">Will it be higher in 24 hours? A right call pays {cr(GAME_CONFIG.forecast.winCredits)}.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button disabled={!!busy} onClick={() => doCall(1)} className="rounded-2xl py-4 text-lg font-extrabold text-bg active:scale-[0.98]" style={{ background: UP }}>
                      ▲ Rises
                    </button>
                    <button disabled={!!busy} onClick={() => doCall(-1)} className="rounded-2xl py-4 text-lg font-extrabold text-bg active:scale-[0.98]" style={{ background: DOWN }}>
                      ▼ Falls
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Your cards */}
          {mine.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow">You own {mine.length === 1 ? "1 card" : `${mine.length} cards`}</p>
              <ul className="mt-3 space-y-2">
                {mine.map((c) => {
                  const worth = cardWorth(trend.value, c.rarity);
                  const gain = trend.value / c.bought_at - 1;
                  const pay = sellPrice(trend.value, c.rarity);
                  return (
                    <li key={c.id} className="flex items-center gap-3 rounded-3xl bg-surface p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold capitalize">
                          {c.rarity}
                          {GAME_CONFIG.rarityMultiplier[c.rarity] > 1 && <span className="text-muted"> ×{GAME_CONFIG.rarityMultiplier[c.rarity]}</span>}
                          <span className="ml-2 font-mono text-xs font-normal text-muted normal-case">{c.origin === "buy" ? "bought" : "from a pack"} at {c.bought_at.toFixed(1)}</span>
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: tone(gain) }}>
                          {signedPct(gain)} · {signed(worth - cardWorth(c.bought_at, c.rarity))} cr
                        </p>
                      </div>
                      <button
                        onClick={() => doSell(c)}
                        disabled={busy === c.id || c.id.startsWith("pending")}
                        className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors active:scale-[0.98] ${confirm === c.id ? "bg-accent text-ivory" : "bg-ivory text-bg"}`}
                      >
                        {confirm === c.id ? `Confirm · ${num(pay)}` : gain >= 0 ? `Take profit · ${num(pay)}` : `Sell · ${num(pay)}`}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-muted">Selling pays the card&rsquo;s worth minus {Math.round(GAME_CONFIG.market.sellFee * 100)}%.</p>
            </div>
          )}
          {msg && <p className="mt-4 text-center font-bold">{msg}</p>}
        </div>
      </div>

      {/* Buy bar */}
      {trend.listed && state && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Buy at {trend.value.toFixed(1)}</p>
              <p className="font-mono text-xs text-muted">You have {cr(credits)}</p>
            </div>
            <button
              onClick={doBuy}
              disabled={busy === "buy" || credits < price}
              className="rounded-2xl bg-ivory px-6 py-4 text-lg font-extrabold text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {credits < price ? "Not enough credits" : `Buy · ${num(price)} cr`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
