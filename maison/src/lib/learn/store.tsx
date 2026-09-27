"use client";

/**
 * The whole app state in the browser: profile, progress, board, duels (one call to
 * `maison_learn_state`), plus hearts (kept on the device) and the running lesson or duel.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { LEARN_CONFIG } from "@/config/learn";
import type { Family, TrendStyle } from "@/lib/cards/families";
import { supabaseBrowser } from "@/lib/supabase/client";
import { QUESTION_POOL } from "./content";

type Status = "loading" | "signed-out" | "no-house" | "ready";

export interface Profile {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  manifesto: string;
  xp: number;
  streak: number;
  best_streak: number;
  last_lesson_day: string | null;
  duels_won: number;
}

export interface Duel {
  id: string;
  questions: string[];
  me_a: boolean;
  my_score: number | null;
  my_ms: number | null;
  their_score: number | null;
  opponent: { name: string; monogram: string; palette: string[] } | null;
  invite: boolean;
  winner: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface BoardRow {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  xp: number;
}

export interface LearnState {
  house: Profile;
  today: string;
  week_start: string;
  today_xp: number;
  week_xp: number;
  progress: Record<string, { best: number; runs: number }>;
  board: BoardRow[];
  duels: Duel[];
}

export interface MarketTrend {
  id: string;
  name: string;
  family: Family;
  style: TrendStyle;
  value: number;
  weekAgo: number;
}

export type Play = { kind: "lesson"; lessonId: string } | { kind: "duel"; duel: Duel };

interface Learn {
  status: Status;
  state: LearnState | null;
  userName: string;
  hearts: number;
  nextHeartAt: number | null;
  loseHeart: () => void;
  play: Play | null;
  startLesson: (lessonId: string) => void;
  endPlay: () => void;
  refresh: () => Promise<void>;
  finishLesson: (lessonId: string, correct: number, total: number) => Promise<{ xp: number; streak: number; extended: boolean } | null>;
  quickDuel: () => Promise<string | null>;
  inviteDuel: () => Promise<string | null>;
  joinDuel: (id: string) => Promise<string | null>;
  submitDuel: (id: string, score: number, ms: number) => Promise<Duel | null>;
  loadMarket: () => Promise<MarketTrend[]>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Learn | null>(null);
const STATE_KEY = "maison:learn:v1";
const HEARTS_KEY = "maison:hearts:v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: fine */
  }
}

/** Hearts refill one every `refillMinutes`. */
function currentHearts(saved: { hearts: number; at: number } | null, now: number) {
  const { max, refillMinutes } = LEARN_CONFIG.hearts;
  if (!saved) return { hearts: max, at: now };
  const step = refillMinutes * 60_000;
  const gained = Math.floor((now - saved.at) / step);
  const hearts = Math.min(max, saved.hearts + gained);
  return { hearts, at: hearts >= max ? now : saved.at + gained * step };
}

const ERRORS: Record<string, string> = {
  duel_taken: "Someone else already accepted this duel.",
  duel_not_found: "This duel doesn't exist any more.",
  already_played: "You already played this duel.",
};
const friendly = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? "Something went wrong. Try again.";

/** A mixed set of questions from every unit. */
function duelQuestions(): string[] {
  const pool = [...QUESTION_POOL].filter((x) => x.q.type === "choice" || x.q.type === "truefalse");
  const out: string[] = [];
  const units = [...new Set(pool.map((x) => x.unit))].sort(() => Math.random() - 0.5);
  while (out.length < LEARN_CONFIG.duel.questions) {
    const unit = units[out.length % units.length];
    const options = pool.filter((x) => x.unit === unit && !out.includes(x.id));
    out.push(options[Math.floor(Math.random() * options.length)].id);
  }
  return out;
}

export function LearnProvider({ children }: { children: React.ReactNode }) {
  const sb = supabaseBrowser();
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<LearnState | null>(null);
  const [userName, setUserName] = useState("");
  const [heartState, setHeartState] = useState<{ hearts: number; at: number }>({ hearts: LEARN_CONFIG.hearts.max, at: 0 });
  const [play, setPlay] = useState<Play | null>(null);
  const stateRef = useRef<LearnState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const s = read<LearnState>(STATE_KEY);
    const h = currentHearts(read(HEARTS_KEY), Date.now());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage
    if (s) setState((cur) => cur ?? s);
    setHeartState(h);
    // Refill hearts over time.
    const id = setInterval(() => setHeartState((cur) => currentHearts(cur, Date.now())), 30_000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) {
      setStatus("signed-out");
      setState(null);
      write(STATE_KEY, null);
      return;
    }
    const meta = session.user.user_metadata as { full_name?: string } | undefined;
    setUserName(meta?.full_name?.split(" ")[0] ?? "");
    const { data, error } = await sb.rpc("maison_learn_state");
    if (error) {
      setStatus((s) => (s === "loading" && stateRef.current ? "ready" : s));
      return;
    }
    const s = data as LearnState | { house: null };
    if (!s.house) {
      setStatus("no-house");
      setState(null);
      write(STATE_KEY, null);
      return;
    }
    setState(s as LearnState);
    setStatus("ready");
    write(STATE_KEY, s);
  }, [sb]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network fetch, state is set when it answers
    refresh();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refresh();
    });
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sb, refresh]);

  const loseHeart = () =>
    setHeartState((cur) => {
      const now = currentHearts(cur, Date.now());
      const next = { hearts: Math.max(0, now.hearts - 1), at: now.hearts >= LEARN_CONFIG.hearts.max ? Date.now() : now.at };
      write(HEARTS_KEY, next);
      return next;
    });

  const finishLesson: Learn["finishLesson"] = async (lessonId, correct, total) => {
    const { data, error } = await sb.rpc("maison_finish_lesson", { p_lesson: lessonId, p_correct: correct, p_total: total });
    refresh();
    if (error) return null;
    return data as { xp: number; streak: number; extended: boolean };
  };

  const startDuel = (duel: Duel) => {
    if (duel.my_score === null) setPlay({ kind: "duel", duel });
    refresh();
  };

  const quickDuel: Learn["quickDuel"] = async () => {
    const { data, error } = await sb.rpc("maison_duel_quick", { p_questions: duelQuestions() });
    if (error || !data) return friendly(error?.message ?? "");
    startDuel(data as Duel);
    return null;
  };
  const inviteDuel: Learn["inviteDuel"] = async () => {
    const { data, error } = await sb.rpc("maison_duel_invite", { p_questions: duelQuestions() });
    if (error || !data) return friendly(error?.message ?? "");
    startDuel(data as Duel);
    return null;
  };
  const joinDuel: Learn["joinDuel"] = async (id) => {
    const { data, error } = await sb.rpc("maison_duel_join", { p_id: id });
    if (error || !data) return friendly(error?.message ?? "");
    startDuel(data as Duel);
    return null;
  };
  const submitDuel: Learn["submitDuel"] = async (id, score, ms) => {
    const { data, error } = await sb.rpc("maison_duel_submit", { p_id: id, p_score: score, p_ms: ms });
    refresh();
    return error ? null : (data as Duel);
  };

  const loadMarket = async (): Promise<MarketTrend[]> => {
    const [{ data: rows }, { data: hist }] = await Promise.all([
      sb.from("maison_trends").select("id, name, family, style, value, source").eq("active", true).eq("listed", true),
      sb.rpc("maison_history", { p_ids: null, p_days: 8 }),
    ]);
    const h = new Map(((hist ?? []) as { trend_id: string; points: number[] }[]).map((x) => [x.trend_id, x.points.map(Number)]));
    return ((rows ?? []) as { id: string; name: string; family: Family; style: TrendStyle | null; value: number; source: string }[])
      .filter((r) => r.source !== "sim" && r.source !== "seed")
      .map((r) => {
        const pts = h.get(r.id) ?? [];
        return { id: r.id, name: r.name, family: r.family, style: r.style ?? {}, value: Number(r.value), weekAgo: pts[0] ?? Number(r.value) };
      });
  };

  const signOut = async () => {
    await sb.auth.signOut();
    write(STATE_KEY, null);
    setState(null);
    setStatus("signed-out");
  };

  const nextHeartAt =
    heartState.hearts >= LEARN_CONFIG.hearts.max ? null : heartState.at + LEARN_CONFIG.hearts.refillMinutes * 60_000;

  return (
    <Ctx.Provider
      value={{
        status,
        state,
        userName,
        hearts: heartState.hearts,
        nextHeartAt,
        loseHeart,
        play,
        startLesson: (lessonId) => setPlay({ kind: "lesson", lessonId }),
        endPlay: () => setPlay(null),
        refresh,
        finishLesson,
        quickDuel,
        inviteDuel,
        joinDuel,
        submitDuel,
        loadMarket,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLearn() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLearn outside LearnProvider");
  return v;
}
