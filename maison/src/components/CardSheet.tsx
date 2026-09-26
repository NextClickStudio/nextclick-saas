"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GAME_CONFIG } from "@/config/game";
import { FAMILY_LABELS } from "@/lib/cards/catalog";
import { CardView, cardNumbers } from "@/lib/cards/view";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DOWN, TrendCard, UP } from "./TrendCard";

const pct = (v: number) => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(1)}%`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US")}`;

/** Full-screen card detail with Take profit / Cut loss / Put on runway. */
export function CardSheet({ card, onClose }: { card: CardView | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {card && (
        <motion.div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <SheetBody card={card} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetBody({ card, onClose }: { card: CardView; onClose: () => void }) {
  const router = useRouter();
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState<"" | "sell" | "runway">("");
  const [done, setDone] = useState<string>("");
  const n = cardNumbers(card);
  const profit = n.pnl >= 0;

  const sell = async () => {
    if (!card.id) return;
    setBusy("sell");
    const { data, error } = await supabaseBrowser().rpc("maison_sell_card", { p_card: card.id });
    setBusy("");
    if (error) return setDone(error.message);
    navigator.vibrate?.(30);
    setDone(`Sold for ${Number(data).toLocaleString("en-US")} cr`);
    router.refresh();
    setTimeout(onClose, 900);
  };

  const runway = async () => {
    if (!card.id) return;
    setBusy("runway");
    const { error } = await supabaseBrowser().rpc("maison_set_runway", { p_card: card.id });
    setBusy("");
    if (error) return setDone(error.message);
    setDone("On the runway");
    router.refresh();
    setTimeout(onClose, 700);
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 pb-12 sm:px-8">
      <button onClick={onClose} className="flex items-center gap-2 text-lg font-bold text-muted hover:text-ivory">
        <span aria-hidden>&lsaquo;</span> Back
      </button>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
        <div className="mx-auto w-full max-w-[340px] md:mx-0">
          <TrendCard card={card} flipped={flipped} onClick={() => setFlipped((f) => !f)} />
        </div>
        <div className="flex-1">
          <p className="eyebrow">
            {FAMILY_LABELS[card.family]} · {card.rarity} · ×{n.multiplier}
          </p>
          <h2 className="headline mt-3 text-5xl">{card.name}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label={`Since you pulled it at ${card.boughtAt.toFixed(1)}`} value={`${profit ? "+" : "−"}${Math.abs(n.pnl * 100).toFixed(1)}%`} color={profit ? UP : DOWN} />
            <Stat label="Profit / loss" value={`${signed(n.pnlCredits)} cr`} color={profit ? UP : DOWN} />
            <Stat label="Worth now" value={`${n.worth.toLocaleString("en-US")} cr`} />
            <Stat label="Today" value={pct(n.change)} color={n.change >= 0 ? UP : DOWN} />
            <Stat label="Index" value={card.value.toFixed(1)} />
            <Stat label="Contract" value={`${card.daysLeft} days`} bar={card.daysLeft / GAME_CONFIG.cards.lifespanDays} />
          </div>
          {card.id && (
            <>
              <div className="mt-3 rounded-3xl bg-surface p-5 text-sm leading-relaxed text-muted">
                {profit ? "It's up. Take the profit now, or hold for more and risk the drop." : "It's down. Cut the loss now, or hold and wait for the rebound."}{" "}
                Selling pays <span className="font-extrabold text-ivory">{n.sell.toLocaleString("en-US")} cr</span> ({Math.round(GAME_CONFIG.cards.sellFee * 100)}% fee). If it expires,
                it&rsquo;s sold at {Math.round(GAME_CONFIG.cards.expirySellRate * 100)}%: {n.expiryPayout.toLocaleString("en-US")} cr.
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={sell}
                  disabled={!!busy}
                  className="flex-1 rounded-2xl py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-60"
                  style={{ background: profit ? UP : "#f2eee6" }}
                >
                  {busy === "sell" ? "Selling…" : `${profit ? "Take profit" : "Cut loss"} · ${n.sell.toLocaleString("en-US")}`}
                </button>
                <button
                  onClick={runway}
                  disabled={!!busy || card.onRunway}
                  className="flex-1 rounded-2xl bg-surface-2 py-4 text-lg font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {card.onRunway ? "On the runway" : busy === "runway" ? "…" : "Put on runway"}
                </button>
              </div>
              {done && <p className="mt-3 text-center font-bold">{done}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, bar }: { label: string; value: string; color?: string; bar?: number }) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${bar <= 0.25 ? "bg-accent" : "bg-ivory"}`} style={{ width: `${Math.max(4, bar * 100)}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}
