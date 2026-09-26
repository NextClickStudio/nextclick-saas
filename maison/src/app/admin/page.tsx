"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Splash } from "@/components/Splash";
import { useGame } from "@/lib/game/store";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AdminPage() {
  const { status, state } = useGame();
  const router = useRouter();
  const [data, setData] = useState<{ trends: Parameters<typeof AdminPanel>[0]["trends"]; runs: Parameters<typeof AdminPanel>[0]["runs"] } | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: trends }, { data: runs }] = await Promise.all([
      sb.from("maison_trends").select("id, name, family, query, value, day_open, source, updated_at, active").order("family").order("name"),
      sb.rpc("maison_admin_runs", { lim: 15 }),
    ]);
    setData({ trends: trends ?? [], runs: runs ?? [] });
  }, []);

  const admin = state?.admin;
  useEffect(() => {
    if (status === "signed-out") router.replace("/");
    if (status === "ready" && admin === false) router.replace("/today");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network fetch
    if (status === "ready" && admin) load();
  }, [status, admin, router, load]);

  if (!data) return <Splash />;
  return <AdminPanel trends={data.trends} runs={data.runs} onChange={load} />;
}
