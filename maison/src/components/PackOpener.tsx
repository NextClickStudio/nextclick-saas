"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { GAME_CONFIG } from "@/config/game";
import type { CardView } from "@/lib/cards/view";
import { cr, num, vibrate } from "@/lib/format";
import { trendCard, useGame } from "@/lib/game/store";
import { PackArt } from "./PackArt";
import { TrendCard } from "./TrendCard";

type Stage = "idle" | "loading" | "tearing" | "reveal" | "summary";

/** The daily pack: tear it, flip five cards one by one. The last one can be the big one. */
export function PackOpener() {
  const { state, market, openPack, openSheet } = useGame();
  const [stage, setStage] = useState<Stage>("idle");
  const [cards, setCards] = useState<CardView[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState("");
  const [firstOpen, setFirstOpen] = useState<boolean | null>(null);
  if (!state || !market) return null;

  const freeReady = state.house.last_pack_day !== state.today;
  const credits = state.house.credits;
  const price = GAME_CONFIG.pack.extraPackCredits;
  const streak = state.house.streak;
  const firstPack = firstOpen ?? Object.keys(state.archive).length === 0;

  const open = async (paid: boolean) => {
    setError("");
    setFirstOpen(Object.keys(state.archive).length === 0);
    const before = new Set(Object.keys(state.archive));
    setStage("loading");
    vibrate(20);
    const res = await openPack(paid);
    if (res.error !== undefined) {
      setError(res.error);
      setStage("idle");
      return;
    }
    const views = res.cards.filter((c) => market.has(c.trend_id)).map((c) => trendCard(market.get(c.trend_id)!, c));
    setFresh(new Set(res.cards.map((c) => c.trend_id).filter((id) => !before.has(id))));
    setCards(views);
    setI(0);
    setFlipped(false);
    setStage("tearing");
    vibrate([30, 40, 60]);
    setTimeout(() => setStage("reveal"), 1100);
  };

  const current = cards[i];
  const revealed = flipped;

  const tap = () => {
    if (!current) return;
    if (!revealed) {
      setFlipped(true);
      if (current.rarity === "legendary") vibrate([80, 60, 80, 60, 200]);
      else if (current.rarity === "epic") vibrate([60, 50, 120]);
      else if (current.rarity === "rare") vibrate(50);
      else vibrate(15);
      return;
    }
    if (i < cards.length - 1) {
      setI(i + 1);
      setFlipped(false);
    } else {
      setStage("summary");
    }
  };

  const best = cards.reduce<CardView | null>((b, c) => {
    const r = (x: CardView) => ["common", "rare", "epic", "legendary"].indexOf(x.rarity);
    return !b || r(c) > r(b) ? c : b;
  }, null);
  const packWorth = cards.reduce((s, c) => s + Math.round(c.value * GAME_CONFIG.rarityMultiplier[c.rarity] * GAME_CONFIG.market.creditsPerPoint), 0);

  const share = async () => {
    if (!best) return;
    const text = `I just pulled a ${best.rarity} ${best.name} card on Maison, the fashion trend market.`;
    try {
      if (navigator.share) await navigator.share({ title: "Maison", text, url: location.origin });
      else await navigator.clipboard.writeText(`${text} ${location.origin}`);
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-7rem)] max-w-md flex-col items-center overflow-hidden px-5 pt-6">
      {/* IDLE: the sealed pack */}
      {(stage === "idle" || stage === "loading") && (
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <p className="eyebrow">{freeReady ? (firstPack ? "Your first pack" : "Today's pack") : "Extra pack"}</p>
          <h1 className="headline mt-2 text-center text-4xl">{freeReady ? "Five cards. One could be legendary." : "Want more cards?"}</h1>
          <motion.div
            className="mt-8 w-[62vw] max-w-[260px]"
            animate={stage === "loading" ? { rotate: [-2, 2, -2, 2, 0], scale: [1, 1.02, 1] } : { y: [0, -8, 0] }}
            transition={stage === "loading" ? { duration: 0.5, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <PackArt label={freeReady ? "Daily pack" : "Extra pack"} date={new Date().toISOString().slice(0, 10)} />
          </motion.div>
          {freeReady && (
            <p className="mt-6 text-center text-sm font-bold text-muted">
              {streak > 0 ? `Open it today to make it a ${streak + 1}-day streak. Every day of streak boosts your odds of rare cards.` : "Open one every day: your streak boosts the odds of rare cards."}
            </p>
          )}
          {!freeReady && <p className="mt-6 text-center text-sm font-bold text-muted">Your free pack is back at midnight UTC. Or open an extra one now.</p>}
          <div className="mt-8 w-full space-y-3">
            {freeReady ? (
              <button
                onClick={() => open(false)}
                disabled={stage === "loading"}
                className="w-full rounded-2xl bg-ivory py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {stage === "loading" ? "Tearing…" : "Tear it open"}
              </button>
            ) : (
              <button
                onClick={() => open(true)}
                disabled={stage === "loading" || credits < price}
                className="w-full rounded-2xl bg-ivory py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {credits < price ? `Extra pack · ${num(price)} cr (you have ${num(credits)})` : `Open an extra pack · ${num(price)} cr`}
              </button>
            )}
          </div>
          {error && <p className="mt-4 text-center text-sm font-bold text-accent">{error}</p>}
        </div>
      )}

      {/* TEARING */}
      {stage === "tearing" && (
        <div className="relative flex w-full flex-1 items-center justify-center">
          <div className="relative w-[62vw] max-w-[260px]">
            <motion.div
              className="absolute inset-x-0 top-0 z-10 h-[16%] overflow-hidden rounded-t-[28px]"
              initial={{ y: 0, rotate: 0, opacity: 1 }}
              animate={{ y: -220, x: 60, rotate: 28, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.5, 0, 0.75, 0] }}
            >
              <div className="h-[625%]">
                <PackArt />
              </div>
            </motion.div>
            <motion.div initial={{ scale: 1 }} animate={{ scale: [1, 1.04, 0.9], opacity: [1, 1, 0] }} transition={{ duration: 1.1, times: [0, 0.4, 1] }}>
              <div style={{ clipPath: "inset(16% 0 0 0 round 0 0 28px 28px)" }}>
                <PackArt />
              </div>
            </motion.div>
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full bg-ivory blur-3xl"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 0.5, 0], scale: [0.4, 1.4, 1.8] }}
              transition={{ duration: 1.1 }}
            />
          </div>
        </div>
      )}

      {/* REVEAL */}
      {stage === "reveal" && current && (
        <div className="flex w-full flex-1 flex-col items-center justify-center" onClick={tap}>
          <div className="mb-5 flex gap-2">
            {cards.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-ivory" : k < i ? "w-1.5 bg-ivory/60" : "w-1.5 bg-surface-2"}`} />
            ))}
          </div>
          <div className="relative w-[70vw] max-w-[300px]">
            <AnimatePresence>
              {revealed && (current.rarity === "epic" || current.rarity === "legendary") && <Burst key={`b${i}`} rarity={current.rarity} />}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ y: 80, opacity: 0, scale: 0.9, rotate: -4 }}
                animate={{ y: 0, opacity: 1, scale: revealed && current.rarity === "legendary" ? 1.04 : 1, rotate: 0 }}
                exit={{ y: -260, x: 80, opacity: 0, rotate: 14 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10"
              >
                <TrendCard card={current} flipped={!revealed} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-6 h-16 text-center">
            {revealed ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {current.rarity !== "common" && (
                  <p className={`headline text-3xl capitalize ${current.rarity === "legendary" ? "text-gold" : current.rarity === "epic" ? "text-accent" : ""}`}>{current.rarity}!</p>
                )}
                <p className="mt-1 text-sm font-bold text-muted">{i < cards.length - 1 ? "Tap for the next card" : "Tap to finish"}</p>
              </motion.div>
            ) : (
              <p className="text-sm font-bold text-muted">{i === cards.length - 1 ? "The last one. Tap to flip." : firstPack && i === 0 ? "Tap the card to flip it" : "Tap to flip"}</p>
            )}
          </div>
        </div>
      )}

      {/* SUMMARY */}
      {stage === "summary" && (
        <motion.div className="w-full pb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="eyebrow">Added to your maison · worth {cr(packWorth)}</p>
          <h1 className="headline mt-2 text-4xl">{firstPack ? "Your first five trends." : fresh.size ? `${fresh.size} new in your archive.` : "Five more cards."}</h1>
          <p className="mt-3 text-base leading-snug text-muted">
            {firstPack
              ? "Their prices move with Google searches, every hour. Sell a card when it's up, hold it if you think the trend is only starting. Tap a card to see its chart."
              : "Tap a card to see its chart, sell it or keep it."}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div key={c.id} className="relative">
                <TrendCard card={c} onClick={() => openSheet(c.trendId, c.id)} />
                {fresh.has(c.trendId) && <span className="absolute -top-2 -left-1 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-ivory uppercase">New</span>}
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {best && best.rarity !== "common" && (
              <button onClick={share} className="block w-full rounded-2xl bg-gold py-4 text-center text-lg font-bold text-bg">
                Share my {best.rarity} {best.name}
              </button>
            )}
            <Link href="/today#forecast" className="block w-full rounded-2xl bg-ivory py-4 text-center text-lg font-bold text-bg">
              {firstPack ? "Next: make your first calls" : "Back to today"}
            </Link>
            <Link href="/maison" className="block w-full rounded-2xl bg-surface py-4 text-center text-lg font-bold">
              See my maison
            </Link>
          </div>
        </motion.div>
      )}
    </main>
  );
}

/** Particles + glow behind an epic / legendary reveal. */
function Burst({ rarity }: { rarity: "epic" | "legendary" }) {
  const color = rarity === "legendary" ? "#d4ad55" : "#e5452d";
  const n = rarity === "legendary" ? 28 : 16;
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="absolute inset-[-30%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${color}, transparent 65%)` }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.9, 0.5], scale: [0.5, 1.2, 1] }}
        transition={{ duration: 1.2 }}
      />
      {Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2;
        const d = 170 + (k % 5) * 30;
        return (
          <motion.span
            key={k}
            className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full"
            style={{ background: k % 3 === 0 ? "#fff6dc" : color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1 + (k % 4) * 0.15, ease: "easeOut" }}
          />
        );
      })}
    </motion.div>
  );
}
