"use client";

import { Bolt, Flame } from "@/components/learn/Icons";
import { Monogram } from "@/components/Monogram";
import { leagueOf } from "@/config/learn";
import { UNITS } from "@/lib/learn/content";
import { useLearn } from "@/lib/learn/store";

export default function ProfilePage() {
  const { state, signOut } = useLearn();
  if (!state) return null;
  const { house, progress } = state;
  const league = leagueOf(house.xp);
  const total = UNITS.reduce((s, u) => s + u.lessons.length, 0);
  const done = Object.keys(progress).length;

  return (
    <main className="mx-auto max-w-xl px-5">
      <header className="flex items-center gap-4 pt-[max(env(safe-area-inset-top),24px)]">
        <Monogram house={house} size={72} />
        <div className="min-w-0">
          <h1 className="headline truncate text-3xl">{house.name}</h1>
          <p className="mt-1 text-sm font-bold" style={{ color: league.color }}>
            {league.name} league
          </p>
          {house.manifesto && <p className="mt-1 line-clamp-2 text-sm text-muted">{house.manifesto}</p>}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat icon={<Flame className="h-6 w-6 text-[#ff8a3d]" />} value={house.streak} label="Day streak" />
        <Stat icon={<Bolt className="h-6 w-6 text-gold" />} value={house.xp} label="Total XP" />
        <Stat value={house.best_streak} label="Best streak" />
        <Stat value={`${done}/${total}`} label="Lessons" />
        <Stat value={house.duels_won} label="Duels won" />
        <Stat value={state.week_xp} label="XP this week" />
      </section>

      <section className="mt-8">
        <p className="eyebrow">Your knowledge</p>
        <ul className="mt-3 space-y-3">
          {UNITS.map((u) => {
            const d = u.lessons.filter((l) => progress[l.id]).length;
            return (
              <li key={u.id} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold">{u.title}</span>
                  <span className="font-mono text-xs text-muted">
                    {d}/{u.lessons.length}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(d / u.lessons.length) * 100}%`, background: u.color === "#1b1a19" ? "#d4ad55" : u.color }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-12 flex justify-center">
        <button onClick={signOut} className="text-sm font-bold text-muted underline-offset-4 hover:underline">
          Sign out
        </button>
      </div>
    </main>
  );
}

function Stat({ icon, value, label }: { icon?: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <p className="flex items-center gap-2 text-2xl font-extrabold tabular-nums">
        {icon}
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
