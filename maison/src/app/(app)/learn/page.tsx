"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Bolt, Crown, Flame, Heart, Lock } from "@/components/learn/Icons";
import { LEARN_CONFIG, leagueOf } from "@/config/learn";
import { UNITS } from "@/lib/learn/content";
import { useLearn } from "@/lib/learn/store";

const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44];

export default function LearnPage() {
  const { state, hearts, startLesson } = useLearn();
  const [toast, setToast] = useState("");
  if (!state) return null;
  const { house, progress } = state;
  const league = leagueOf(house.xp);
  const goal = Math.min(1, state.today_xp / LEARN_CONFIG.dailyGoal);
  const totalLessons = UNITS.reduce((s, u) => s + u.lessons.length, 0);
  const doneLessons = Object.keys(progress).length;

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  };

  return (
    <main className="mx-auto max-w-xl px-5">
      {/* Stats bar */}
      <header className="sticky top-0 z-20 -mx-5 flex items-center justify-between bg-bg/95 px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3 backdrop-blur">
        <span className="rounded-full px-3 py-1.5 text-sm font-extrabold" style={{ background: `${league.color}22`, color: league.color }}>
          {league.name}
        </span>
        <div className="flex items-center gap-4 font-extrabold tabular-nums">
          <span className={`flex items-center gap-1 ${house.streak > 0 ? "text-[#ff8a3d]" : "text-muted"}`}>
            <Flame className="h-6 w-6" /> {house.streak}
          </span>
          <span className="flex items-center gap-1 text-gold">
            <Bolt className="h-5 w-5" /> {house.xp}
          </span>
          <span className="flex items-center gap-1 text-accent">
            <Heart className="h-5 w-5" /> {hearts}
          </span>
        </div>
      </header>

      {/* Daily goal */}
      <section className="mt-3 rounded-3xl bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Daily goal</p>
          <p className="font-mono text-xs text-muted">
            {Math.min(state.today_xp, LEARN_CONFIG.dailyGoal)}/{LEARN_CONFIG.dailyGoal} XP
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${Math.max(2, goal * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted">
          {goal >= 1
            ? "Goal reached. Your streak is safe for today."
            : house.streak > 0 && house.last_lesson_day !== state.today
              ? `Do one lesson today to keep your ${house.streak}-day streak.`
              : "Two lessons a day make a fashion expert in a few months."}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {doneLessons}/{totalLessons} lessons completed
        </p>
      </section>

      {/* The path */}
      {UNITS.map((unit, ui) => {
        const done = unit.lessons.filter((l) => progress[l.id]).length;
        const current = unit.lessons.findIndex((l) => !progress[l.id]);
        return (
          <section key={unit.id} className="mt-8">
            <div className="rounded-3xl p-5" style={{ background: unit.color, color: unit.ink }}>
              <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-70">
                Unit {ui + 1} · {done}/{unit.lessons.length}
              </p>
              <h2 className="headline mt-2 text-3xl">{unit.title}</h2>
              <p className="mt-1 text-sm opacity-80">{unit.blurb}</p>
            </div>
            <div className="mt-6 flex flex-col items-center gap-5">
              {unit.lessons.map((lesson, li) => {
                const isDone = !!progress[lesson.id];
                const isCurrent = li === current;
                const locked = !isDone && !isCurrent;
                const perfect = isDone && progress[lesson.id].best >= lesson.questions.length;
                return (
                  <div key={lesson.id} className="flex flex-col items-center" style={{ transform: `translateX(${OFFSETS[li % OFFSETS.length]}px)` }}>
                    {isCurrent && (
                      <motion.span
                        className="mb-2 rounded-xl bg-ivory px-3 py-1 text-xs font-black tracking-wider text-bg uppercase"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      >
                        Start
                      </motion.span>
                    )}
                    <button
                      onClick={() => (locked ? say("Finish the lesson before this one first.") : startLesson(lesson.id))}
                      className={`relative grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95 ${
                        locked ? "bg-surface-2 text-muted" : ""
                      }`}
                      style={
                        locked
                          ? { boxShadow: "0 6px 0 #1b1a19" }
                          : { background: unit.color, color: unit.ink, boxShadow: `0 6px 0 rgba(0,0,0,0.45)${isCurrent ? ", 0 0 0 6px rgba(242,238,230,0.15)" : ""}` }
                      }
                      aria-label={lesson.title}
                    >
                      {locked ? <Lock className="h-7 w-7" /> : perfect ? <Crown className="h-8 w-8" /> : isDone ? <span className="text-3xl font-black">✓</span> : <span className="text-2xl font-black">{li + 1}</span>}
                    </button>
                    <span className={`mt-2 max-w-[140px] text-center text-sm font-bold ${locked ? "text-muted" : ""}`}>{lesson.title}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}


      {toast && (
        <div className="fixed inset-x-0 bottom-28 z-30 flex justify-center px-5">
          <p className="rounded-2xl bg-ivory px-5 py-3 text-sm font-bold text-bg shadow-lg">{toast}</p>
        </div>
      )}
    </main>
  );
}
