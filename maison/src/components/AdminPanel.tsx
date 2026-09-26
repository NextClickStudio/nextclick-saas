"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface TrendRow {
  id: string;
  name: string;
  family: string;
  query: string;
  value: number;
  day_open: number;
  source: string;
  updated_at: string;
  active: boolean;
}

interface Run {
  id: number;
  started_at: string;
  source: string | null;
  ok: number;
  failed: number;
  note: string | null;
}

/** Admin: override trend values, import a CSV, run the market update now. */
export function AdminPanel({ trends, runs, onChange }: { trends: TrendRow[]; runs: Run[]; onChange: () => void }) {
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => trends.filter((t) => `${t.name} ${t.id} ${t.family}`.toLowerCase().includes(q.toLowerCase())), [trends, q]);

  const save = async (id: string, value: number) => {
    const { error } = await supabaseBrowser().rpc("maison_admin_set_value", { p_trend: id, p_value: value });
    if (error) throw error;
  };

  const saveEdits = async () => {
    setBusy(true);
    setMsg("");
    try {
      for (const [id, v] of Object.entries(edits)) if (Number(v) > 0) await save(id, Number(v));
      setMsg(`Saved ${Object.keys(edits).length} values.`);
      setEdits({});
      onChange();
    } catch (e) {
      setMsg(String((e as Error).message ?? e));
    }
    setBusy(false);
  };

  const importCsv = async () => {
    setBusy(true);
    setMsg("");
    let n = 0;
    try {
      for (const line of csv.split(/\r?\n/)) {
        const [id, v] = line.split(/[,;\t]/).map((s) => s.trim());
        if (!id || !v || isNaN(Number(v)) || id === "id") continue;
        await save(id, Number(v));
        n++;
      }
      setMsg(`Imported ${n} values.`);
      setCsv("");
      onChange();
    } catch (e) {
      setMsg(String((e as Error).message ?? e));
    }
    setBusy(false);
  };

  const toggle = async (t: TrendRow) => {
    await supabaseBrowser().rpc("maison_admin_set_active", { p_trend: t.id, p_active: !t.active });
    onChange();
  };

  const runNow = async () => {
    setBusy(true);
    setMsg("Running the market update… (up to a minute)");
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/maison-market?force=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    setMsg(`Market update: ${await res.text()}`);
    setBusy(false);
    onChange();
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pt-6 pb-16 sm:px-8">
      <Link href="/today" className="text-lg font-bold text-muted">
        &lsaquo; Back
      </Link>
      <p className="eyebrow mt-6">Admin</p>
      <h1 className="headline mt-2 text-5xl">The market desk</h1>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl bg-surface p-5">
          <p className="eyebrow">Automatic updates</p>
          <p className="mt-2 text-sm text-muted">Every 10 minutes the stalest trends are refreshed from Google search interest, and new trends get listed. Force a run now:</p>
          <button onClick={runNow} disabled={busy} className="mt-4 w-full rounded-2xl bg-ivory py-3 font-bold text-bg disabled:opacity-50">
            Run market update now
          </button>
          <ul className="mt-4 space-y-1 font-mono text-xs text-muted">
            {runs.map((r) => (
              <li key={r.id}>
                {new Date(r.started_at).toLocaleString()} · {r.source} · ok {r.ok} · fail {r.failed}
                {r.note ? ` · ${r.note.slice(0, 80)}` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-surface p-5">
          <p className="eyebrow">Import CSV</p>
          <p className="mt-2 text-sm text-muted">One line per trend: id,value (e.g. mary-janes,180). Overrides the index now.</p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            placeholder={"id,value\nmary-janes,180\ncobalt,95"}
            className="mt-3 w-full rounded-2xl bg-bg px-4 py-3 font-mono text-sm outline-none"
          />
          <button onClick={importCsv} disabled={busy || !csv.trim()} className="mt-3 w-full rounded-2xl bg-surface-2 py-3 font-bold disabled:opacity-50">
            Import
          </button>
        </div>
      </section>

      {msg && <p className="mt-4 rounded-2xl bg-surface p-4 font-mono text-sm break-words">{msg}</p>}

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trends" className="flex-1 rounded-2xl bg-surface px-4 py-3 outline-none" />
          <button onClick={saveEdits} disabled={busy || !Object.keys(edits).length} className="rounded-2xl bg-ivory px-5 py-3 font-bold text-bg disabled:opacity-40">
            Save {Object.keys(edits).length || ""} changes
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-3xl bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Search</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((t) => {
                const ch = t.day_open ? (t.value / t.day_open - 1) * 100 : 0;
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2">
                      <span className="font-extrabold">{t.name}</span>
                      <span className="block font-mono text-xs text-muted">
                        {t.id} · {t.family}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted">{t.query}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {t.source}
                      <span className="block text-muted">{new Date(t.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className={`px-4 py-2 font-extrabold tabular-nums ${ch >= 0 ? "text-[#5fd08a]" : "text-accent"}`}>{ch.toFixed(1)}%</td>
                    <td className="px-4 py-2">
                      <input
                        inputMode="decimal"
                        value={edits[t.id] ?? String(t.value)}
                        onChange={(e) => setEdits((x) => ({ ...x, [t.id]: e.target.value }))}
                        className="w-24 rounded-xl bg-bg px-3 py-2 font-bold tabular-nums outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => toggle(t)} className={`rounded-full px-3 py-1 text-xs font-extrabold ${t.active ? "bg-ivory text-bg" : "bg-bg text-muted"}`}>
                        {t.active ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
