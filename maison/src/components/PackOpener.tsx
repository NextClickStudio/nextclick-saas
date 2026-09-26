"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Rarity } from "@/config/game";
import type { Family } from "@/lib/cards/catalog";
import type { CardView, TrendStyle } from "@/lib/cards/view";
import { supabaseBrowser } from "@/lib/supabase/client";
import { PackArt } from "./PackArt";
import { TrendCard } from "./TrendCard";

type Stage = "idle" | "loading" | "tearing" | "reveal" | "summary";

interface Props {
  freeReady: boolean;
  credits: number;
  price: number;
  streak: number;
  firstPack: boolean;
}

const vibrate = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not supported */
  }
};

/** The daily pack: tear it, flip five cards one by one. The last one can be the big one. */
export function PackOpener({ freeReady, credits, price, streak, firstPack }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [cards, setCards] = useState<CardView[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState("");

  const open = async (paid: boolean) => {
    setError("");
    setStage("loading");
    vibrate(20);
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc(paid ? "maison_buy_pack" : "maison_open_pack");
    if (error || !data) {
      setError(error?.message.includes("already_opened") ? "Today's pack is already open. Come back tomorrow." : error?.message.includes("not_enough_credits") ? "Not enough credits yet." : (error?.message ?? "Something went wrong."));
      setStage("idle");
      return;
    }
    const rows = data as { id: string; trend_id: string; rarity: Rarity; serial: number; bought_at: number; expires_at: string; on_runway: boolean }[];
    const ids = [...new Set(rows.map((r) => r.trend_id))];
    const [{ data: trends }, { data: hist }] = await Promise.all([
      sb.from("maison_trends").select("id, name, family, style, value, day_open").in("id", ids),
      sb.rpc("maison_history", { p_ids: ids, p_days: 30 }),
    ]);
    const tMap = new Map((trends ?? []).map((t) => [t.id as string, t]));
    const hMap = new Map(((hist ?? []) as { trend_id: string; points: number[] }[]).map((h) => [h.trend_id, h.points.map(Number)]));
    const views: CardView[] = rows.map((r) => {
      const t = tMap.get(r.trend_id)!;
      const h = hMap.get(r.trend_id) ?? [];
      return {
        id: r.id,
        trendId: r.trend_id,
        name: t.name as string,
        family: t.family as Family,
        style: (t.style ?? {}) as TrendStyle,
        rarity: r.rarity,
        serial: r.serial,
        daysLeft: Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86_400_000),
        value: Number(t.value),
        dayOpen: Number(t.day_open),
        boughtAt: Number(r.bought_at),
        history: h.length ? h : [Number(t.value)],
        onRunway: r.on_runway,
      };
    });
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
      router.refresh();
    }
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-7rem)] max-w-md flex-col items-center overflow-hidden px-5 pt-6">
      {/* IDLE: the sealed pack */}
      {(stage === "idle" || stage === "loading") && (
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <p className="eyebrow">{freeReady ? (firstPack ? "Your first pack" : "Today's pack") : "Extra pack"}</p>
          <h1 className="headline mt-2 text-center text-4xl">{freeReady ? "Five cards. One could be legendary." : "Come back tomorrow."}</h1>
          <motion.div
            className="mt-8 w-[62vw] max-w-[260px]"
            animate={stage === "loading" ? { rotate: [-2, 2, -2, 2, 0], scale: [1, 1.02, 1] } : { y: [0, -8, 0] }}
            transition={stage === "loading" ? { duration: 0.5, repeat: Infinity } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <PackArt label={freeReady ? "Daily pack" : "Extra pack"} date={new Date().toISOString().slice(0, 10)} />
          </motion.div>
          {streak > 1 && freeReady && <p className="mt-6 text-sm font-bold text-muted">{streak}-day streak · better odds for rares</p>}
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
                {credits < price ? `Extra pack · ${price.toLocaleString("en-US")} cr (you have ${credits.toLocaleString("en-US")})` : `Open an extra pack · ${price.toLocaleString("en-US")} cr`}
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
        <motion.div className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="eyebrow">Added to your maison</p>
          <h1 className="headline mt-2 text-4xl">{firstPack ? "Your first collection." : "Five new cards."}</h1>
          {firstPack && (
            <p className="mt-3 text-base leading-snug text-muted">
              One card per family went straight onto your runway. Their trends move every hour, following real search interest. Sell a card when it&rsquo;s up, or hold it and
              ride the trend. Tonight at midnight your first duel begins.
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <TrendCard key={c.id} card={c} />
            ))}
          </div>
          <div className="mt-6 space-y-3 pb-6">
            <Link href="/home" className="block w-full rounded-2xl bg-ivory py-4 text-center text-lg font-bold text-bg">
              See my maison
            </Link>
            <Link href="/cards" className="block w-full rounded-2xl bg-surface py-4 text-center text-lg font-bold">
              Manage my cards
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
