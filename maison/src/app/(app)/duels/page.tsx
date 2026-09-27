"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Monogram } from "@/components/Monogram";
import { LEARN_CONFIG } from "@/config/learn";
import { ago } from "@/lib/format";
import { type Duel, useLearn } from "@/lib/learn/store";

export default function DuelsPage() {
  return (
    <Suspense>
      <Duels />
    </Suspense>
  );
}

function Duels() {
  const { state, quickDuel, inviteDuel, joinDuel } = useLearn();
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const joined = useRef(false);

  // Opened from a friend's link: join and play.
  useEffect(() => {
    const id = params.get("join");
    if (!id || joined.current) return;
    joined.current = true;
    joinDuel(id).then((err) => {
      if (err) setError(err);
      router.replace("/duels");
    });
  }, [params, joinDuel, router]);

  if (!state) return null;
  const me = state.house.user_id;
  const toPlay = state.duels.filter((d) => d.my_score === null);
  const waiting = state.duels.filter((d) => d.my_score !== null && d.their_score === null);
  const done = state.duels.filter((d) => d.winner);
  const wins = done.filter((d) => d.winner === me).length;

  const run = async (kind: "quick" | "invite") => {
    setBusy(kind);
    setError("");
    const err = await (kind === "quick" ? quickDuel() : inviteDuel());
    setBusy("");
    if (err) setError(err);
  };

  return (
    <main className="mx-auto max-w-xl px-5">
      <header className="pt-[max(env(safe-area-inset-top),24px)]">
        <p className="eyebrow">Quiz duels</p>
        <h1 className="headline mt-3 text-5xl">Prove your eye.</h1>
        <p className="mt-3 text-base text-muted">
          {LEARN_CONFIG.duel.questions} questions from every corner of fashion, {LEARN_CONFIG.duel.secondsPerQuestion} seconds each. The sharper (and faster) wins{" "}
          {LEARN_CONFIG.xp.duelWin} XP.
        </p>
      </header>

      <div className="mt-6 grid gap-3">
        <button
          onClick={() => run("quick")}
          disabled={!!busy}
          className="rounded-3xl bg-ivory p-5 text-left text-bg transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">Random opponent</p>
          <p className="headline mt-1 text-2xl">{busy === "quick" ? "Finding a duel…" : "Quick duel"}</p>
        </button>
        <button
          onClick={() => run("invite")}
          disabled={!!busy}
          className="rounded-3xl bg-gold p-5 text-left text-bg transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <p className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">Send a link</p>
          <p className="headline mt-1 text-2xl">{busy === "invite" ? "Creating…" : "Challenge a friend"}</p>
        </button>
      </div>
      {error && <p className="mt-3 text-center text-sm font-bold text-accent">{error}</p>}

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat label="Played" value={done.length} />
        <Stat label="Won" value={wins} />
        <Stat label="Win rate" value={done.length ? `${Math.round((wins / done.length) * 100)}%` : "–"} />
      </div>

      {toPlay.length > 0 && <List title="Your turn" duels={toPlay} me={me} />}
      {waiting.length > 0 && <List title="Waiting for the opponent" duels={waiting} me={me} />}
      {done.length > 0 && <List title="Results" duels={done} me={me} />}
      {state.duels.length === 0 && <p className="mt-10 text-center text-muted">No duels yet. Start one above.</p>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function List({ title, duels, me }: { title: string; duels: Duel[]; me: string }) {
  const { joinDuel } = useLearn();
  const [copied, setCopied] = useState("");
  const share = async (d: Duel) => {
    const url = `${location.origin}/duels?join=${d.id}`;
    const text = `I scored ${d.my_score}/${d.questions.length} in a Maison fashion duel. Beat me:`;
    try {
      if (navigator.share) await navigator.share({ title: "Maison duel", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(d.id);
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <section className="mt-8">
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 space-y-2">
        {duels.map((d) => {
          const won = d.winner === me;
          return (
            <li key={d.id} className="flex items-center gap-3 rounded-3xl bg-surface p-4">
              {d.opponent ? <Monogram house={d.opponent} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 font-black text-muted">?</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{d.opponent?.name ?? (d.invite ? "Friend (link)" : "Finding opponent")}</p>
                <p className="font-mono text-xs text-muted">{ago(d.finished_at ?? d.created_at)}</p>
              </div>
              {d.my_score === null ? (
                <button onClick={() => joinDuel(d.id)} className="rounded-2xl bg-ivory px-4 py-2 font-extrabold text-bg">
                  Play
                </button>
              ) : d.winner ? (
                <span className="text-right">
                  <span className="block font-extrabold tabular-nums">
                    {d.my_score} – {d.their_score}
                  </span>
                  <span className={`text-xs font-black uppercase ${won ? "text-[#5fd08a]" : "text-accent"}`}>{won ? "Won" : "Lost"}</span>
                </span>
              ) : d.invite ? (
                <button onClick={() => share(d)} className="rounded-2xl bg-gold px-4 py-2 text-sm font-extrabold text-bg">
                  {copied === d.id ? "Copied" : "Send link"}
                </button>
              ) : (
                <span className="font-extrabold tabular-nums">
                  {d.my_score}/{d.questions.length}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
