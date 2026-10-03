import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getConnection, metaConfigured } from "@/lib/instagram";
import { isInstagramPost, RADAR_RUNS_PER_DAY, readProfile } from "@/lib/radar";
import { getCurrentUser } from "@/lib/supabase-auth";
import RadarView, { type RadarItem } from "./radar-view";

export const metadata: Metadata = { title: "Radar" };

/** Data di oggi in Italia (AAAA-MM-GG), come la conta il limite giornaliero. */
function todayRome(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
}

/** Il collegamento Meta dura 60 giorni: avvisa nell'ultima settimana. */
function expiringSoon(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso!).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

type Props = { searchParams: Promise<{ ig?: string; ig_error?: string }> };

export default async function RadarPage({ searchParams }: Props) {
  const { ig, ig_error } = await searchParams;
  const user = (await getCurrentUser())!;
  const [{ data: account }, { data: items }, conn] = await Promise.all([
    db().from("accounts").select("radar_profile, radar_last_run_at, company_offer, radar_runs_day, radar_runs_count").eq("user_id", user.id).single(),
    db()
      .from("radar_items")
      .select("id, url, platform, signal, author, company, posted, excerpt, why, intent, status, reply, likes, comments, created_at")
      .eq("user_id", user.id)
      .neq("status", "scartato")
      .order("created_at", { ascending: false })
      .limit(150),
    getConnection(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Instagram · brand nuovi del tuo settore, ogni giorno</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Radar</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Con una ricerca Yeppo scopre su Instagram brand nuovi del tuo settore (verificati: niente persone) e legge i loro ultimi post.
          L&apos;AI ti scrive il commento: tu lo pubblichi e diventi un nome conosciuto prima ancora del DM. Ogni mattina ti ricordo la
          ricerca del giorno.
        </p>
      </div>
      <RadarView
        profile={readProfile(account?.radar_profile)}
        lastRun={account?.radar_last_run_at ?? null}
        runsLeft={RADAR_RUNS_PER_DAY - (account?.radar_runs_day === todayRome() ? Number(account?.radar_runs_count ?? 0) : 0)}
        runsPerDay={RADAR_RUNS_PER_DAY}
        hasOffer={Boolean(account?.company_offer)}
        instagram={conn ? { username: conn.ig_username, expiringSoon: expiringSoon(conn.token_expires_at) } : null}
        metaReady={metaConfigured()}
        flash={ig ? { ok: true, text: `Instagram collegato: @${ig}` } : ig_error ? { ok: false, text: ig_error } : null}
        items={((items ?? []) as RadarItem[]).filter((i) => isInstagramPost(i.url))}
      />
    </div>
  );
}
