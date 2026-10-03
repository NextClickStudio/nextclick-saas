import type { Metadata } from "next";
import { db } from "@/lib/db";
import { readProfile } from "@/lib/radar";
import { getCurrentUser } from "@/lib/supabase-auth";
import RadarView, { type RadarItem } from "./radar-view";

export const metadata: Metadata = { title: "Radar" };

export default async function RadarPage() {
  const user = (await getCurrentUser())!;
  const [{ data: account }, { data: items }] = await Promise.all([
    db().from("accounts").select("radar_profile, radar_last_run_at, company_offer").eq("user_id", user.id).single(),
    db()
      .from("radar_items")
      .select("id, url, platform, signal, author, company, posted, excerpt, why, intent, status, reply, created_at")
      .eq("user_id", user.id)
      .neq("status", "scartato")
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Chi ti sta cercando</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Radar</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Ogni giorno Yeppo cerca post, richieste, annunci di lavoro e lanci di aziende del tuo target che parlano proprio di
          quello che fai. Rispondi per primo: l&apos;AI ti scrive il commento o il messaggio.
        </p>
      </div>
      <RadarView
        profile={readProfile(account?.radar_profile)}
        lastRun={account?.radar_last_run_at ?? null}
        hasOffer={Boolean(account?.company_offer)}
        items={(items ?? []) as RadarItem[]}
      />
    </div>
  );
}
