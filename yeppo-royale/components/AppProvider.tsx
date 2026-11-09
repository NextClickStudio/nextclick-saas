"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import type { Look } from "@/lib/avatar";
import type { Session, User } from "@/lib/types";

type AppState = {
  ready: boolean;
  session: Session | null;
  me: User | null;
  creating: boolean;
  openCreator: (open: boolean) => void;
  signup: (handle: string, look: Look) => Promise<void>;
  login: (secret: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<User | null>;
  setMe: (u: User) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const refreshMe = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) {
      setMe(null);
      return null;
    }
    try {
      const u = await rpc<User>("yr_me", { p_secret: s.secret });
      setMe(u);
      return u;
    } catch (e) {
      if (e instanceof Error && /Session expired/.test(e.message)) {
        writeLocal("yr:session", null);
        setSession(null);
        setMe(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const s = readLocal<Session | null>("yr:session", null);
    setSession(s);
    sessionRef.current = s;
    void refreshMe().finally(() => setReady(true));
  }, [refreshMe]);

  useEffect(() => {
    const t = setInterval(() => void refreshMe(), 60_000);
    return () => clearInterval(t);
  }, [refreshMe]);

  const adopt = useCallback(
    async (s: Session) => {
      writeLocal("yr:session", s);
      sessionRef.current = s;
      setSession(s);
      await refreshMe();
    },
    [refreshMe],
  );

  const signup = useCallback(
    async (handle: string, look: Look) => {
      const r = await rpc<{ user: User; secret: string }>("yr_signup", { p_handle: handle, p_avatar: look });
      await adopt({ secret: r.secret, userId: r.user.id, handle: r.user.handle });
    },
    [adopt],
  );

  const login = useCallback(
    async (secret: string) => {
      const u = await rpc<User>("yr_me", { p_secret: secret.trim() });
      await adopt({ secret: secret.trim(), userId: u.id, handle: u.handle });
    },
    [adopt],
  );

  const logout = useCallback(() => {
    writeLocal("yr:session", null);
    sessionRef.current = null;
    setSession(null);
    setMe(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({ ready, session, me, creating, openCreator: setCreating, signup, login, logout, refreshMe, setMe }),
    [ready, session, me, creating, signup, login, logout, refreshMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
