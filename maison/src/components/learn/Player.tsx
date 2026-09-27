"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LEARN_CONFIG } from "@/config/learn";
import { FAMILY_LABELS } from "@/lib/cards/families";
import { DOWN, UP, timeLeft, vibrate } from "@/lib/format";
import { lessonById, questionById, QUESTION_POOL } from "@/lib/learn/content";
import { type Duel, type MarketTrend, useLearn } from "@/lib/learn/store";
import type { Option, Question, Visual } from "@/lib/learn/types";
import { Swatch } from "../Swatch";
import { Flame, Heart } from "./Icons";
import { VisualTile } from "./VisualTile";

/** A question ready to play: options shuffled, live data resolved. */
type Ready =
  | { type: "choice"; prompt: string; visual?: Visual; options: Option[]; answer: number; explain?: string; trends?: MarketTrend[] }
  | { type: "truefalse"; prompt: string; answer: boolean; explain?: string }
  | { type: "pairs"; prompt: string; left: Option[]; right: string[]; match: Record<number, number> }
  | { type: "order"; prompt: string; items: string[]; shuffled: number[]; explain?: string };

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function prepare(q: Question, market: MarketTrend[]): Ready | null {
  switch (q.type) {
    case "choice": {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
    }
    case "truefalse":
      return q;
    case "pairs": {
      const rightOrder = shuffle(q.pairs.map((_, i) => i));
      const match: Record<number, number> = {};
      q.pairs.forEach((_, i) => (match[i] = rightOrder.indexOf(i)));
      return { type: "pairs", prompt: q.prompt, left: q.pairs.map(([l]) => l), right: rightOrder.map((i) => q.pairs[i][1]), match };
    }
    case "order":
      return { ...q, shuffled: shuffle(q.items.map((_, i) => i)) };
    case "live": {
      const pool = shuffle(market);
      if (q.mode === "higher") {
        const [a, b] = pool;
        if (!a || !b || a.value === b.value) return null;
        return {
          type: "choice",
          prompt: "Which trend is hotter right now on Google?",
          options: [a.name, b.name],
          answer: a.value > b.value ? 0 : 1,
          trends: [a, b],
          explain: `${a.name} ${a.value.toFixed(1)} vs ${b.name} ${b.value.toFixed(1)} (index: 100 = its usual level).`,
        };
      }
      const t = pool.find((x) => x.value !== x.weekAgo);
      if (!t) return null;
      const move = t.value / t.weekAgo - 1;
      return {
        type: "choice",
        prompt: `${t.name}: did it go up or down on Google in the last 7 days?`,
        options: ["Up", "Down"],
        answer: move > 0 ? 0 : 1,
        trends: [t],
        explain: `${move > 0 ? "Up" : "Down"} ${Math.abs(move * 100).toFixed(1)}% this week.`,
      };
    }
  }
}

const optText = (o: Option) => (typeof o === "string" ? o : "");

export function Player() {
  const { play } = useLearn();
  return (
    <AnimatePresence>
      {play && (
        <motion.div
          key="player"
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25 }}
        >
          {play.kind === "lesson" ? <LessonRun lessonId={play.lessonId} /> : <DuelRun duel={play.duel} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- lesson
function LessonRun({ lessonId }: { lessonId: string }) {
  const { endPlay, hearts, loseHeart, nextHeartAt, finishLesson, loadMarket, state } = useLearn();
  const lesson = lessonById(lessonId)!;
  const [queue, setQueue] = useState<Ready[] | null>(null);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<{ xp: number; streak: number; extended: boolean } | "failed" | null>(null);
  const done = useRef(false);
  const [firstTotal, setFirstTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const needsMarket = lesson.questions.some((q) => q.type === "live");
      const market = needsMarket ? await loadMarket() : [];
      let list = shuffle(lesson.questions)
        .map((q) => prepare(q, market))
        .filter((x): x is Ready => !!x);
      // Not enough live data yet: fall back to aesthetics questions.
      if (list.length < 5) {
        const extra = shuffle(QUESTION_POOL.filter((x) => x.unit === "aesthetics")).slice(0, 8);
        list = [...list, ...extra.map((x) => prepare(x.q, market)!).filter(Boolean)].slice(0, 8);
      }
      if (alive) {
        setFirstTotal(list.length);
        setQueue(list);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lesson, loadMarket]);

  const retried = useRef(new Set<number>());
  const onAnswer = (ok: boolean) => {
    const isRetry = i >= firstTotal;
    if (ok) {
      if (!isRetry) setCorrect((c) => c + 1);
      vibrate(15);
    } else {
      loseHeart();
      vibrate([40, 40, 40]);
      // Wrong answers come back at the end of the lesson, once.
      if (!retried.current.has(i) && queue) {
        retried.current.add(i);
        setQueue([...queue, queue[i]]);
      }
    }
  };

  const next = async () => {
    if (!queue) return;
    if (hearts <= 0) {
      setResult("failed");
      return;
    }
    if (i < queue.length - 1) {
      setI(i + 1);
      return;
    }
    if (done.current) return;
    done.current = true;
    const r = await finishLesson(lessonId, correct, firstTotal);
    setResult(r ?? { xp: 0, streak: state?.house.streak ?? 0, extended: false });
    vibrate([30, 60, 30, 60, 120]);
  };

  if (hearts <= 0 && !result) {
    return <OutOfHearts onClose={endPlay} nextHeartAt={nextHeartAt} />;
  }

  return (
    <>
      <TopBar onClose={endPlay} progress={queue ? (i + (result ? 1 : 0)) / queue.length : 0}>
        <span className="flex items-center gap-1 font-extrabold text-accent">
          <Heart className="h-6 w-6" /> {hearts}
        </span>
      </TopBar>
      {!queue ? (
        <div className="grid flex-1 place-items-center text-muted">Preparing your lesson…</div>
      ) : result === "failed" ? (
        <OutOfHearts onClose={endPlay} nextHeartAt={nextHeartAt} />
      ) : result ? (
        <LessonDone title={lesson.title} xp={result.xp} streak={result.streak} extended={result.extended} correct={correct} total={firstTotal} onClose={endPlay} />
      ) : (
        <QuestionRun key={i} q={queue[i]} onAnswer={onAnswer} onNext={next} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- duel
function DuelRun({ duel }: { duel: Duel }) {
  const { endPlay, submitDuel } = useLearn();
  const [queue] = useState<Ready[]>(() => duel.questions.map((id) => questionById(id)).filter((q): q is Question => !!q).map((q) => prepare(q, [])!));
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [final, setFinal] = useState<Duel | null>(null);
  const [left, setLeft] = useState<number>(LEARN_CONFIG.duel.secondsPerQuestion);
  const [locked, setLocked] = useState(false);
  const started = useRef(0);
  const totalMs = useRef(0);
  const finishing = useRef(false);

  const lockedRef = useRef(false);
  const advanceRef = useRef<(ok: boolean) => void>(() => {});

  const advance = async (ok: boolean) => {
    totalMs.current += performance.now() - started.current;
    const s = score + (ok ? 1 : 0);
    setScore(s);
    if (i < queue.length - 1) {
      lockedRef.current = false;
      setI(i + 1);
      setLocked(false);
      setLeft(LEARN_CONFIG.duel.secondsPerQuestion);
      return;
    }
    if (finishing.current) return;
    finishing.current = true;
    const d = await submitDuel(duel.id, s, Math.round(totalMs.current));
    setFinal(d ?? { ...duel, my_score: s });
  };
  useEffect(() => {
    advanceRef.current = advance;
  });

  useEffect(() => {
    started.current = performance.now();
    const id = setInterval(() => {
      const s = Math.max(0, LEARN_CONFIG.duel.secondsPerQuestion - Math.floor((performance.now() - started.current) / 1000));
      setLeft(s);
      if (s === 0 && !lockedRef.current) {
        // Time's up: counts as wrong.
        lockedRef.current = true;
        setLocked(true);
        vibrate([40, 40, 40]);
        setTimeout(() => advanceRef.current(false), 700);
      }
    }, 250);
    return () => clearInterval(id);
  }, [i]);

  return (
    <>
      <TopBar onClose={endPlay} progress={(i + (final ? 1 : 0)) / queue.length}>
        {!final && (
          <span className={`w-10 text-right font-mono text-lg font-extrabold tabular-nums ${left <= 5 ? "text-accent" : ""}`}>{left}s</span>
        )}
      </TopBar>
      {final ? (
        <DuelDone duel={final} total={queue.length} onClose={endPlay} />
      ) : (
        <QuestionRun
          key={i}
          q={queue[i]}
          duel
          disabled={locked}
          onAnswer={(ok) => {
            lockedRef.current = true;
            setLocked(true);
            vibrate(ok ? 15 : [40, 40, 40]);
            setTimeout(() => advance(ok), 650);
          }}
          onNext={() => {}}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- shared UI
function TopBar({ onClose, progress, children }: { onClose: () => void; progress: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
      <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-2xl text-muted active:bg-surface">
        ×
      </button>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div className="h-full rounded-full bg-[#5fd08a]" animate={{ width: `${Math.max(3, progress * 100)}%` }} transition={{ duration: 0.4 }} />
      </div>
      {children}
    </div>
  );
}

function QuestionRun({
  q,
  onAnswer,
  onNext,
  duel = false,
  disabled = false,
}: {
  q: Ready;
  onAnswer: (ok: boolean) => void;
  onNext: () => void;
  duel?: boolean;
  disabled?: boolean;
}) {
  const [picked, setPicked] = useState<number | boolean | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pairs, setPairs] = useState<{ left: number | null; done: number[]; wrong: [number, number] | null; mistakes: number }>({
    left: null,
    done: [],
    wrong: null,
    mistakes: 0,
  });

  const settle = (ok: boolean) => {
    if (verdict !== null) return;
    setVerdict(ok);
    onAnswer(ok);
  };

  // Duels answer on tap; lessons use a Check button.
  const choose = (v: number | boolean) => {
    if (verdict !== null || disabled) return;
    setPicked(v);
    if (duel) settle(q.type === "choice" ? v === q.answer : q.type === "truefalse" ? v === q.answer : false);
  };

  const check = () => {
    if (q.type === "choice") settle(picked === q.answer);
    else if (q.type === "truefalse") settle(picked === q.answer);
    else if (q.type === "order") settle(order.every((v, k) => v === k));
  };

  const tapPair = (side: "l" | "r", k: number) => {
    if (verdict !== null || q.type !== "pairs") return;
    if (side === "l") return setPairs((p) => ({ ...p, left: k, wrong: null }));
    if (pairs.left === null) return;
    if (q.match[pairs.left] === k) {
      const done = [...pairs.done, pairs.left];
      setPairs((p) => ({ ...p, left: null, done }));
      vibrate(10);
      if (done.length === q.left.length) settle(pairs.mistakes === 0);
    } else {
      setPairs((p) => ({ ...p, wrong: [p.left!, k], left: null, mistakes: p.mistakes + 1 }));
      vibrate(30);
    }
  };

  const canCheck =
    (q.type === "choice" || q.type === "truefalse") ? picked !== null : q.type === "order" ? order.length === q.items.length : false;

  const correctText =
    q.type === "choice"
      ? optText(q.options[q.answer]) || "The highlighted one"
      : q.type === "truefalse"
        ? q.answer
          ? "True"
          : "False"
        : q.type === "order"
          ? q.items.join(" → ")
          : "";
  const explain = "explain" in q ? q.explain : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-5 pt-4 pb-6">
        <h2 className="text-2xl leading-tight font-extrabold text-balance">{q.prompt}</h2>

        {q.type === "choice" && (
          <>
            {q.visual && <VisualTile v={q.visual} className="mx-auto mt-5 aspect-square w-[46vw] max-w-[220px]" rounded="rounded-[28px]" />}
            {q.trends && (
              <div className="mt-5 flex justify-center gap-4">
                {q.trends.map((t) => (
                  <div key={t.id} className="flex flex-col items-center gap-2 text-center">
                    <Swatch family={t.family} style={t.style} name={t.name} size={72} />
                    <span className="font-mono text-[11px] text-muted">{FAMILY_LABELS[t.family]}</span>
                  </div>
                ))}
              </div>
            )}
            {q.options.every((o) => typeof o !== "string") ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {q.options.map((o, k) => (
                  <button
                    key={k}
                    onClick={() => choose(k)}
                    className={`rounded-[26px] p-2 transition-all active:scale-[0.97] ${stateRing(k, picked, verdict, q.answer)}`}
                  >
                    <VisualTile v={o as Visual} className="aspect-square w-full" rounded="rounded-[20px]" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {q.options.map((o, k) => (
                  <button
                    key={k}
                    onClick={() => choose(k)}
                    className={`w-full rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold transition-all active:scale-[0.99] ${stateBorder(k, picked, verdict, q.answer)}`}
                  >
                    {optText(o)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {q.type === "truefalse" && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => choose(v)}
                className={`rounded-2xl border-2 py-6 text-xl font-extrabold transition-all active:scale-[0.98] ${stateBorder(v, picked, verdict, q.answer)}`}
              >
                {v ? "True" : "False"}
              </button>
            ))}
          </div>
        )}

        {q.type === "pairs" && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="space-y-3">
              {q.left.map((o, k) => {
                const done = pairs.done.includes(k);
                const wrong = pairs.wrong?.[0] === k;
                return (
                  <button
                    key={k}
                    disabled={done}
                    onClick={() => tapPair("l", k)}
                    className={`flex h-20 w-full items-center justify-center rounded-2xl border-2 p-2 text-center text-sm font-bold transition-all ${
                      done ? "border-transparent opacity-25" : wrong ? "border-accent" : pairs.left === k ? "border-ivory bg-surface-2" : "border-line"
                    }`}
                  >
                    {typeof o === "string" ? o : <VisualTile v={o} className="h-full w-full" rounded="rounded-xl" />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              {q.right.map((r, k) => {
                const done = pairs.done.some((l) => q.match[l] === k);
                const wrong = pairs.wrong?.[1] === k;
                return (
                  <button
                    key={k}
                    disabled={done}
                    onClick={() => tapPair("r", k)}
                    className={`flex h-20 w-full items-center justify-center rounded-2xl border-2 p-2 text-center text-sm font-bold transition-all ${
                      done ? "border-transparent opacity-25" : wrong ? "border-accent" : "border-line"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {q.type === "order" && (
          <>
            <div className="mt-6 min-h-[132px] space-y-2 rounded-2xl border-2 border-dashed border-line p-3">
              {order.map((idx, pos) => (
                <button
                  key={idx}
                  onClick={() => verdict === null && setOrder((o) => o.filter((x) => x !== idx))}
                  className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-left font-bold"
                >
                  <span className="font-mono text-muted">{pos + 1}</span> {q.items[idx]}
                </button>
              ))}
              {order.length === 0 && <p className="py-8 text-center text-sm text-muted">Tap the items in the right order</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {q.shuffled
                .filter((idx) => !order.includes(idx))
                .map((idx) => (
                  <button key={idx} onClick={() => setOrder((o) => [...o, idx])} className="rounded-xl border-2 border-line px-4 py-3 font-bold active:scale-[0.98]">
                    {q.items[idx]}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Footer: check / feedback */}
      {!duel && (
        <div
          className={`border-t px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)] transition-colors ${
            verdict === null ? "border-line" : verdict ? "border-transparent bg-[#5fd08a]/15" : "border-transparent bg-accent/15"
          }`}
        >
          <div className="mx-auto max-w-xl">
            {verdict !== null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
                <p className="text-xl font-extrabold" style={{ color: verdict ? UP : DOWN }}>
                  {verdict ? pick(["Nice!", "Exactly.", "Très chic.", "Correct!", "You know your stuff."]) : "Not quite."}
                </p>
                {!verdict && correctText && q.type !== "pairs" && (
                  <p className="mt-1 font-bold">
                    Answer: <span className="text-ivory">{correctText}</span>
                  </p>
                )}
                {explain && <p className="mt-1 text-sm text-muted">{explain}</p>}
              </motion.div>
            )}
            {verdict === null ? (
              q.type !== "pairs" && (
                <button
                  disabled={!canCheck}
                  onClick={check}
                  className="w-full rounded-2xl bg-ivory py-4 text-lg font-extrabold text-bg transition-transform active:scale-[0.98] disabled:opacity-30"
                >
                  Check
                </button>
              )
            ) : (
              <button
                onClick={onNext}
                className="w-full rounded-2xl py-4 text-lg font-extrabold text-bg transition-transform active:scale-[0.98]"
                style={{ background: verdict ? UP : "#f2eee6" }}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}
      {duel && verdict !== null && (
        <p className="pb-[max(env(safe-area-inset-bottom),24px)] text-center text-xl font-extrabold" style={{ color: verdict ? UP : DOWN }}>
          {verdict ? "Correct" : "Wrong"}
        </p>
      )}
    </div>
  );
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function stateBorder<T>(k: T, picked: T | null, verdict: boolean | null, answer: T) {
  if (verdict !== null) {
    if (k === answer) return "border-[#5fd08a] bg-[#5fd08a]/15";
    if (k === picked) return "border-accent bg-accent/15";
    return "border-line opacity-50";
  }
  return k === picked ? "border-ivory bg-surface-2" : "border-line";
}
function stateRing<T>(k: T, picked: T | null, verdict: boolean | null, answer: T) {
  if (verdict !== null) {
    if (k === answer) return "ring-4 ring-[#5fd08a]";
    if (k === picked) return "ring-4 ring-accent";
    return "opacity-40";
  }
  return k === picked ? "ring-4 ring-ivory" : "ring-1 ring-line";
}

function OutOfHearts({ onClose, nextHeartAt }: { onClose: () => void; nextHeartAt: number | null }) {
  const [now] = useState(() => Date.now());
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <Heart className="h-20 w-20 text-accent" />
      <h2 className="headline mt-6 text-4xl">Out of hearts</h2>
      <p className="mt-3 text-muted">
        {nextHeartAt ? `A new heart arrives in ${timeLeft(nextHeartAt - now)}.` : "Your hearts are back."} Meanwhile, duels don&rsquo;t cost hearts.
      </p>
      <button onClick={onClose} className="mt-8 w-full max-w-sm rounded-2xl bg-ivory py-4 text-lg font-extrabold text-bg">
        OK
      </button>
    </div>
  );
}

function LessonDone({
  title,
  xp,
  streak,
  extended,
  correct,
  total,
  onClose,
}: {
  title: string;
  xp: number;
  streak: number;
  extended: boolean;
  correct: number;
  total: number;
  onClose: () => void;
}) {
  const acc = Math.round((correct / total) * 100);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
        {extended ? <Flame className="h-24 w-24 text-[#ff8a3d]" /> : <span className="text-7xl font-black text-gold">✓</span>}
      </motion.div>
      <p className="eyebrow mt-6">{title}</p>
      <h2 className="headline mt-2 text-4xl">{extended ? `${streak} day streak!` : "Lesson complete!"}</h2>
      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-gold p-4">
          <p className="font-mono text-xs text-gold uppercase">XP</p>
          <p className="text-3xl font-extrabold">+{xp}</p>
        </div>
        <div className="rounded-2xl border-2 border-[#5fd08a] p-4">
          <p className="font-mono text-xs text-[#5fd08a] uppercase">Accuracy</p>
          <p className="text-3xl font-extrabold">{acc}%</p>
        </div>
      </div>
      <button onClick={onClose} className="mt-10 w-full max-w-sm rounded-2xl bg-ivory py-4 text-lg font-extrabold text-bg active:scale-[0.98]">
        Continue
      </button>
    </div>
  );
}

function DuelDone({ duel, total, onClose }: { duel: Duel; total: number; onClose: () => void }) {
  const { state } = useLearn();
  const [copied, setCopied] = useState(false);
  const waiting = duel.their_score === null;
  const iWon = !waiting && duel.winner === state?.house.user_id;
  const link = typeof window !== "undefined" ? `${location.origin}/duels?join=${duel.id}` : "";
  const share = async () => {
    const text = `I scored ${duel.my_score}/${total} in a Maison fashion duel. Beat me:`;
    try {
      if (navigator.share) await navigator.share({ title: "Maison duel", text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p className="eyebrow">{duel.invite ? "Friend duel" : "Quick duel"}</p>
      <h2 className="headline mt-3 text-5xl">{waiting ? `${duel.my_score}/${total}` : iWon ? "You won!" : "You lost"}</h2>
      {waiting ? (
        <p className="mt-4 text-muted">
          {duel.invite ? "Send the link to a friend: whoever scores more (and faster) wins 20 XP." : "We're finding you an opponent. You'll see the result in Duels."}
        </p>
      ) : (
        <p className="mt-4 text-xl font-extrabold">
          You {duel.my_score} · {duel.opponent?.name ?? "Opponent"} {duel.their_score}
        </p>
      )}
      {duel.invite && waiting && (
        <button onClick={share} className="mt-8 w-full max-w-sm rounded-2xl bg-gold py-4 text-lg font-extrabold text-bg active:scale-[0.98]">
          {copied ? "Link copied" : "Send the challenge"}
        </button>
      )}
      <button onClick={onClose} className="mt-3 w-full max-w-sm rounded-2xl bg-ivory py-4 text-lg font-extrabold text-bg active:scale-[0.98]">
        Continue
      </button>
    </div>
  );
}

