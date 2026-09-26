import { Monogram } from "@/components/Monogram";
import { SignOutButton } from "@/components/SignOutButton";
import { requireHouse } from "@/lib/game/data";

interface Entry {
  user_id: string;
  name: string;
  monogram: string;
  palette: string[];
  worth: number;
  duel_streak: number;
}

export default async function RanksPage() {
  const { supabase, user, house } = await requireHouse();
  const { data: board } = await supabase.rpc("maison_leaderboard", { lim: 50 });
  const entries = (board ?? []) as Entry[];
  const myRank = entries.findIndex((e) => e.user_id === user.id) + 1;

  const { data: duels } = await supabase
    .from("maison_duels")
    .select("id, day, a, b, a_score, b_score, winner, settled")
    .or(`a.eq.${user.id},b.eq.${user.id}`)
    .eq("settled", true)
    .order("day", { ascending: false })
    .limit(10);
  const oppIds = [...new Set((duels ?? []).map((d) => (d.a === user.id ? d.b : d.a)).filter(Boolean))] as string[];
  const { data: opps } = oppIds.length ? await supabase.from("maison_houses").select("user_id, name").in("user_id", oppIds) : { data: [] };
  const oppName = new Map((opps ?? []).map((o) => [o.user_id, o.name]));
  const wins = (duels ?? []).filter((d) => d.winner === user.id).length;

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
      <p className="eyebrow">Ranks</p>
      <h1 className="headline mt-2 text-5xl">{myRank ? `You're #${myRank}` : "The houses"}</h1>
      <p className="mt-2 text-lg text-muted">Ranked by maison value: cash plus every card, at market price.</p>

      <ol className="mt-6 divide-y divide-line rounded-3xl bg-surface px-5">
        {entries.map((e, i) => (
          <li key={e.user_id} className={`flex items-center gap-3 py-3 ${e.user_id === user.id ? "font-extrabold" : ""}`}>
            <span className="w-7 font-mono text-sm text-muted">{i + 1}</span>
            <Monogram house={e} size={36} />
            <span className="min-w-0 flex-1 truncate text-base font-extrabold">{e.name}</span>
            {e.duel_streak > 1 && <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-extrabold text-muted">{e.duel_streak} wins</span>}
            <span className="text-base font-extrabold tabular-nums">{e.worth.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <p className="eyebrow">Your duels</p>
        <h2 className="headline mt-2 text-3xl">{duels?.length ? `${wins} won of ${duels.length}` : "No duels yet"}</h2>
        {!!duels?.length && (
          <ul className="mt-4 divide-y divide-line rounded-3xl bg-surface px-5">
            {duels.map((d) => {
              const meA = d.a === user.id;
              const me = Number(meA ? d.a_score : d.b_score) * 100;
              const them = Number(meA ? d.b_score : d.a_score) * 100;
              const won = d.winner === user.id;
              return (
                <li key={d.id} className="flex items-center justify-between py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold">vs {(meA ? oppName.get(d.b ?? "") : oppName.get(d.a)) ?? "the market"}</span>
                    <span className="font-mono text-xs text-muted">{d.day}</span>
                  </span>
                  <span className="text-right">
                    <span className={`block font-extrabold ${won ? "" : "text-accent"}`}>{won ? "Won" : "Lost"}</span>
                    <span className="font-mono text-xs text-muted">
                      {me.toFixed(1)}% vs {them.toFixed(1)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10 flex items-center gap-4 rounded-3xl bg-surface p-5">
        <Monogram house={house} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">{house.name}</p>
          <p className="line-clamp-2 text-sm text-muted">{house.manifesto || "No manifesto yet."}</p>
        </div>
      </section>
      <div className="mt-4 mb-6 text-center">
        <SignOutButton />
      </div>
    </main>
  );
}
