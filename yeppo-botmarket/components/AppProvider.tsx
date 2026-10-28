"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readLocal, rpc, supabase, writeLocal } from "@/lib/supabase";
import { CAPITAL } from "@/lib/strategy";
import { centerOf, floatText, sfx, toast } from "@/lib/fx";
import { pct, pts } from "@/lib/format";
import { normBot, normUser, type Activity, type Bot, type Holding, type Session, type UserStats } from "@/lib/types";

type AuthMode = "signup" | "login" | null;

type AppState = {
  session: Session | null;
  me: (UserStats & { last_claim_at: string | null }) | null;
  holdings: Record<string, Holding>;
  bots: Record<string, Bot>;
  botsReady: boolean;
  activity: Activity[];
  curves: Record<string, number[]>;
  auth: AuthMode;
  openAuth: (mode: AuthMode) => void;
  requireAuth: () => boolean;
  signup: (handle: string) => Promise<void>;
  login: (secret: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  refreshBots: () => Promise<void>;
  patchBot: (raw: Record<string, unknown>) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<AppState["me"]>(null);
  const [holdings, setHoldings] = useState<Record<string, Holding>>({});
  const [bots, setBots] = useState<Record<string, Bot>>({});
  const [botsReady, setBotsReady] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [curves, setCurves] = useState<Record<string, number[]>>({});
  const [auth, setAuth] = useState<AuthMode>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const botsRef = useRef(bots);
  botsRef.current = bots;

  useEffect(() => {
    setSession(readLocal<Session | null>("bm:session", null));
  }, []);

  const refreshBots = useCallback(async () => {
    const { data } = await supabase.from("bm_bots_v").select("*").order("created_at");
    if (data) setBots((prev) => Object.fromEntries(data.map((r) => [r.id as string, normBot(r, prev[r.id as string])])));
    setBotsReady(true);
  }, []);

  const refreshCurves = useCallback(async () => {
    const { data } = await supabase.from("bm_bot_trades").select("bot_id,equity_after").order("id", { ascending: false }).limit(2000);
    if (!data) return;
    const out: Record<string, number[]> = {};
    for (const r of [...data].reverse()) (out[r.bot_id] ??= [CAPITAL]).push(Number(r.equity_after));
    setCurves(out);
  }, []);

  const refreshMe = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      setMe(null);
      setHoldings({});
      return;
    }
    const [u, raw, h] = await Promise.all([
      supabase.from("bm_users_v").select("*").eq("id", s.userId).maybeSingle(),
      supabase.from("bm_users").select("last_claim_at").eq("id", s.userId).maybeSingle(),
      supabase.from("bm_holdings").select("*").eq("user_id", s.userId),
    ]);
    if (u.data) setMe({ ...normUser(u.data), last_claim_at: (raw.data?.last_claim_at as string | null) ?? null });
    if (h.data) {
      setHoldings(
        Object.fromEntries(
          h.data.map((x) => [x.bot_id as string, { ...(x as Holding), shares: +x.shares, cost: +x.cost, dividends: +x.dividends }]),
        ),
      );
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [session, refreshMe]);

  useEffect(() => {
    const t = setInterval(refreshMe, 20_000);
    return () => clearInterval(t);
  }, [refreshMe]);

  // notify the player about the bots they hold
  const onActivity = useCallback(
    (a: Activity) => {
      if (a.kind === "ipo") {
        refreshBots();
        return;
      }
      if (!a.bot_id) return;
      const h = holdingsRef.current[a.bot_id];
      if (a.kind === "close") setTimeout(refreshCurves, 1500);
      if (!h || h.shares <= 0) return;
      if (a.kind === "close") {
        const div = Number(a.data?.dividend ?? 0);
        const bot = botsRef.current[a.bot_id];
        if (div > 0 && bot && bot.supply > 0) {
          const mine = (div * h.shares) / bot.supply;
          sfx.coin();
          toast(`+${pts(mine)} pts dividend · $${a.ticker} closed ${pct(a.data?.pct)}`, "gold");
          const { x, y } = centerOf(document.getElementById("nav-balance"));
          floatText(`+${pts(mine)}`, x, y + 26, "gold");
          refreshMe();
        } else {
          toast(`$${a.ticker} closed ${pct(a.data?.pct)} (${a.data?.reason})`, Number(a.data?.pct) >= 0 ? "up" : "down");
        }
      } else if (a.kind === "open") {
        toast(`$${a.ticker} opened ${String(a.data?.side).toUpperCase()} ${a.data?.lev}x ${a.data?.asset}`, "info");
      } else if (a.kind === "rekt") {
        sfx.lose();
        toast(`💀 $${a.ticker} got rekt`, "down");
      }
    },
    [refreshBots, refreshCurves, refreshMe],
  );
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  useEffect(() => {
    refreshBots();
    refreshCurves();
    supabase
      .from("bm_activity")
      .select("*")
      .neq("kind", "claim")
      .order("id", { ascending: false })
      .limit(60)
      .then(({ data }) => data && setActivity(data as Activity[]));
    const channel = supabase
      .channel("bm:global")
      .on("postgres_changes", { event: "*", schema: "public", table: "bm_bots" }, (m) => {
        const r = m.new as Record<string, unknown>;
        if (r?.id) setBots((prev) => ({ ...prev, [r.id as string]: normBot(r, prev[r.id as string]) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bm_activity" }, (m) => {
        const a = m.new as Activity;
        if (a.kind === "claim") return;
        setActivity((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev].slice(0, 80)));
        onActivityRef.current(a);
      })
      .subscribe();
    const t1 = setInterval(refreshBots, 60_000);
    const t2 = setInterval(refreshCurves, 120_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [refreshBots, refreshCurves]);

  const adopt = useCallback(
    async (s: Session) => {
      writeLocal("bm:session", s);
      sessionRef.current = s;
      setSession(s);
      await refreshMe();
    },
    [refreshMe],
  );

  const signup = useCallback(
    async (handle: string) => {
      const r = await rpc<{ user: { id: string; handle: string }; secret: string }>("bm_signup", { p_handle: handle });
      await adopt({ secret: r.secret, userId: r.user.id, handle: r.user.handle });
    },
    [adopt],
  );

  const login = useCallback(
    async (secret: string) => {
      const u = await rpc<{ id: string; handle: string }>("bm_whoami", { p_secret: secret.trim() });
      await adopt({ secret: secret.trim(), userId: u.id, handle: u.handle });
    },
    [adopt],
  );

  const logout = useCallback(() => {
    writeLocal("bm:session", null);
    sessionRef.current = null;
    setSession(null);
    setMe(null);
    setHoldings({});
  }, []);

  const patchBot = useCallback((raw: Record<string, unknown>) => {
    if (raw?.id) setBots((prev) => ({ ...prev, [raw.id as string]: normBot(raw, prev[raw.id as string]) }));
  }, []);

  const requireAuth = useCallback(() => {
    if (sessionRef.current) return true;
    setAuth("signup");
    return false;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      session,
      me,
      holdings,
      bots,
      botsReady,
      activity,
      curves,
      auth,
      openAuth: setAuth,
      requireAuth,
      signup,
      login,
      logout,
      refreshMe,
      refreshBots,
      patchBot,
    }),
    [session, me, holdings, bots, botsReady, activity, curves, auth, requireAuth, signup, login, logout, refreshMe, refreshBots, patchBot],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
