"use client";

import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { useState } from "react";
import { GAME_CONFIG } from "@/config/game";
import { FAMILY_LABELS } from "@/lib/cards/families";
import { cr, DOWN, signedPct, timeLeft, UP, vibrate } from "@/lib/format";
import { trendCard, useGame } from "@/lib/game/store";
import type { Call, ForecastItem } from "@/lib/game/types";
import { useNow } from "@/lib/useNow";
import { TrendCard } from "./TrendCard";

/**
 * The daily forecast: five trends, one at a time. Swipe right (or tap) if it will rise,
 * left if it will fall. Each right call pays after 24 hours.
 */
export function Forecast() {
  const { state, market, call, openSheet } = useGame();
  const [dragX, setDragX] = useState(0);
  const [error, setError] = useState("");
  if (!state || !market) return null;

  const items = state.forecast.filter((f) => market.has(f.trend_id));
  const next = items.find((f) => !f.dir);
  const done = items.filter((f) => f.dir);
  const t = next ? market.get(next.trend_id)! : null;
  const pending = state.calls.filter((c) => c.result === null && c.day !== state.today);
  const settled = state.calls.filter((c) => c.result !== null).slice(0, 5);

  const make = async (dir: 1 | -1) => {
    if (!next) return;
    vibrate(dir === 1 ? [15, 30, 15] : 25);
    setError("");
    const err = await call(next.trend_id, dir);
    if (err) setError(err);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragX(0);
    if (info.offset.x > 90 || info.velocity.x > 600) make(1);
    else if (info.offset.x < -90 || info.velocity.x < -600) make(-1);
  };

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">The forecast · {done.length}/{items.length}</p>
          <h2 className="headline mt-2 text-3xl">Rise or fall?</h2>
        </div>
        <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-extrabold">+{GAME_CONFIG.forecast.winCredits} cr per right call</span>
      </div>
      <p className="mt-2 text-sm text-muted">Will the price be higher or lower 24 hours after your call? Swipe right if it rises, left if it falls.</p>

      {next && t ? (
        <div className="mt-5 flex flex-col items-center">
          <div className="relative w-[62vw] max-w-[270px]">
            <div
              className="pointer-events-none absolute -inset-6 z-0 rounded-[40px] transition-colors"
              style={{ background: dragX > 30 ? `${UP}22` : dragX < -30 ? `${DOWN}22` : "transparent" }}
            />
            <AnimatePresence mode="popLayout">
              <motion.div
                key={next.trend_id}
                className="relative z-10 cursor-grab touch-pan-y active:cursor-grabbing"
                drag="x"
                dragSnapToOrigin
                dragElastic={0.7}
                onDrag={(_, info) => setDragX(info.offset.x)}
                onDragEnd={onDragEnd}
                style={{ rotate: dragX / 18 }}
                initial={{ scale: 0.92, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ x: dragX >= 0 ? 400 : -400, opacity: 0, rotate: dragX >= 0 ? 20 : -20, transition: { duration: 0.3 } }}
              >
                <TrendCard card={trendCard(t)} />
                {Math.abs(dragX) > 30 && (
                  <span
                    className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-lg font-black text-bg"
                    style={{ background: dragX > 0 ? UP : DOWN }}
                  >
                    {dragX > 0 ? "▲ RISES" : "▼ FALLS"}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="mt-4 text-sm font-bold text-muted">
            {FAMILY_LABELS[t.family]} · {items.length - done.length} left today ·{" "}
            <button className="underline underline-offset-4" onClick={() => openSheet(t.id)}>
              see the chart
            </button>
          </p>
          <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-3">
            <button onClick={() => make(-1)} className="rounded-2xl py-4 text-lg font-extrabold text-bg transition-transform active:scale-[0.97]" style={{ background: DOWN }}>
              ▼ Falls
            </button>
            <button onClick={() => make(1)} className="rounded-2xl py-4 text-lg font-extrabold text-bg transition-transform active:scale-[0.97]" style={{ background: UP }}>
              ▲ Rises
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-bold text-accent">{error}</p>}
        </div>
      ) : (
        items.length > 0 && (
          <div className="mt-5 rounded-3xl bg-surface p-5">
            <p className="text-lg font-extrabold">All five calls made.</p>
            <p className="mt-1 text-sm text-muted">They settle 24 hours after you made them. New forecast at midnight UTC.</p>
          </div>
        )
      )}

      {done.length > 0 && (
        <ul className="mt-5 space-y-2">
          {done.map((f) => (
            <CallRow key={f.trend_id} item={f} />
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <>
          <p className="eyebrow mt-6">Settling soon</p>
          <ul className="mt-3 space-y-2">
            {pending.map((c) => (
              <PastCall key={`${c.day}${c.trend_id}`} call={c} />
            ))}
          </ul>
        </>
      )}
      {settled.length > 0 && (
        <>
          <p className="eyebrow mt-6">Last results</p>
          <ul className="mt-3 space-y-2">
            {settled.map((c) => (
              <PastCall key={`${c.day}${c.trend_id}`} call={c} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CallRow({ item }: { item: ForecastItem }) {
  const { market, openSheet } = useGame();
  const t = market?.get(item.trend_id);
  if (!t || !item.dir) return null;
  const at = Number(item.at);
  const move = t.value / at - 1;
  const right = move * item.dir > 0;
  const flat = t.value === at;
  const total = item.up + item.down || 1;
  const upShare = item.up / total;
  return (
    <li>
      <button onClick={() => openSheet(t.id)} className="w-full rounded-3xl bg-surface p-4 text-left active:scale-[0.99]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold">{t.name}</p>
            <p className="font-mono text-xs text-muted">
              you: {item.dir === 1 ? "rises" : "falls"} from {at.toFixed(1)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-bg px-3 py-1 text-sm font-extrabold tabular-nums" style={{ color: flat ? "#9b968e" : right ? UP : DOWN }}>
            {flat ? "Even" : right ? "Right" : "Wrong"} · {signedPct(move)}
          </span>
        </div>
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-bg">
          <span style={{ width: `${upShare * 100}%`, background: UP }} />
          <span style={{ width: `${(1 - upShare) * 100}%`, background: DOWN }} />
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-muted">
          {Math.round(upShare * 100)}% of maisons say rises · {total} {total === 1 ? "call" : "calls"}
        </p>
      </button>
    </li>
  );
}

function PastCall({ call }: { call: Call }) {
  const { market, openSheet } = useGame();
  const now = useNow();
  const t = market?.get(call.trend_id);
  if (!t) return null;
  const settleAt = new Date(call.created_at).getTime() + GAME_CONFIG.forecast.resolveHours * 3_600_000;
  const live = call.result === null;
  const price = live ? t.value : Number(call.close);
  const right = (price - call.at) * call.dir > 0;
  const label = live
    ? `${right ? "Right" : price === call.at ? "Even" : "Wrong"} so far · settles in ${timeLeft(settleAt - now)}`
    : call.result === "win"
      ? `Right · +${cr(call.paid)}`
      : call.result === "push"
        ? "No move · no payout"
        : "Wrong";
  return (
    <li>
      <button onClick={() => openSheet(t.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{t.name}</span>
          <span className="font-mono text-xs text-muted">
            {call.dir === 1 ? "▲ rises" : "▼ falls"} from {Number(call.at).toFixed(1)}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm font-extrabold" style={{ color: live ? "#f2eee6" : call.result === "win" ? UP : call.result === "loss" ? DOWN : "#9b968e" }}>
          {label}
        </span>
      </button>
    </li>
  );
}
