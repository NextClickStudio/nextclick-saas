import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { activateFromCheckout } from "@/lib/billing";
import { db } from "@/lib/db";
import { COMPANIES_PER_FREE_SESSION, COMPANIES_PER_SESSION, EXTRA_SESSION, FREE_RADAR_RUNS, PLANS, findPlan, formatEuro, planActive } from "@/lib/plans";
import { getCheckout, paymentsEnabled } from "@/lib/stripe";
import { availableSessions, getAccount, getCurrentUser } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";
import BuyButton, { PortalButton } from "./buy-button";

export const metadata: Metadata = { title: "Piani" };

type Props = { searchParams: Promise<{ session_id?: string; annullato?: string; esaurite?: string }> };

export default async function PlansPage({ searchParams }: Props) {
  const user = (await getCurrentUser())!;
  const { session_id, annullato, esaurite } = await searchParams;

  // ritorno da Stripe: conferma subito (il webhook lo farebbe comunque)
  let notice: { tone: "green" | "amber"; text: string } | null = null;
  if (session_id && paymentsEnabled()) {
    try {
      const checkout = await getCheckout(session_id);
      const owner = checkout.client_reference_id ?? checkout.metadata?.user_id;
      if (owner === user.id) {
        if (checkout.mode === "subscription" && checkout.status === "complete") {
          await activateFromCheckout(checkout);
          notice = { tone: "green", text: "Abbonamento attivo: le sessioni del mese sono già disponibili. Grazie!" };
        } else if (checkout.payment_status === "paid") {
          await db().rpc("complete_purchase", { p_stripe_session: session_id });
          notice = { tone: "green", text: "Pagamento completato: la sessione extra è stata aggiunta. Grazie!" };
        } else {
          notice = { tone: "amber", text: "Pagamento in elaborazione: si attiverà appena confermato." };
        }
      }
    } catch (err) {
      console.error("Verifica pagamento", err);
    }
  }
  if (annullato) notice = { tone: "amber", text: "Pagamento annullato. Nessun addebito." };
  if (esaurite) notice = { tone: "amber", text: "Hai usato tutte le sessioni disponibili. Scegli un piano o una sessione extra per continuare." };

  const account = await getAccount(user.id);
  const sessions = availableSessions(account);
  const current = planActive(account.plan_status) ? findPlan(account.plan) : undefined;
  const { data: purchases } = await db()
    .from("purchases")
    .select("id, plan, credits, amount_cents, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(24);
  const enabled = paymentsEnabled();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Piani</h1>
        <p className="mt-2 text-zinc-400">
          Abbonamento mensile, disdici quando vuoi. Hai{" "}
          <strong className="text-white">{sessions === Infinity ? "sessioni illimitate" : `${sessions} ${sessions === 1 ? "sessione" : "sessioni"} disponibili`}</strong>
          {account.free_sessions > 0 && ` (inclusa 1 di prova fino a ${COMPANIES_PER_FREE_SESSION} aziende)`}.
        </p>
      </div>

      {notice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${notice.tone === "green" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
          {notice.text}
        </div>
      )}

      {current ? (
        <div className="glow-border flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-panel p-5">
          <div>
            <p className="text-sm text-zinc-400">Il tuo piano</p>
            <p className="font-display text-2xl font-semibold text-white">
              {current.name} <span className="text-base font-normal text-zinc-400">· {formatEuro(current.priceCents)}/mese</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {account.plan_sessions_left} di {current.sessions} sessioni rimaste questo mese · Radar {current.radarPerDay} {current.radarPerDay === 1 ? "ricerca" : "ricerche"} al giorno
              {account.plan_period_end && ` · rinnovo il ${formatDate(account.plan_period_end)}`}
              {account.plan_status === "past_due" && " · ⚠️ pagamento non riuscito: aggiorna la carta"}
            </p>
          </div>
          <PortalButton />
        </div>
      ) : (
        <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
          Piano gratuito: 1 sessione di prova e {FREE_RADAR_RUNS} ricerche Radar in totale ({account.radar_free_runs_left} rimaste).
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`relative flex flex-col rounded-3xl border p-7 ${p.highlight ? "glow-border border-transparent bg-panel" : "border-white/[0.08] bg-white/[0.02]"}`}>
            {p.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-accent to-cyan px-3 py-1 text-xs font-semibold text-ink">Più scelto</span>
            )}
            <p className="font-display text-xl font-semibold text-white">{p.name}</p>
            <p className="mt-4 font-display text-4xl font-semibold text-white">
              {formatEuro(p.priceCents)}
              <span className="ml-1 text-sm font-normal text-zinc-500">/mese + IVA</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">{formatEuro(Math.round(p.priceCents / p.sessions))} a sessione</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-zinc-300">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><span className="text-cyan">✓</span>{f}</li>
              ))}
            </ul>
            <div className="mt-7">
              {current?.id === p.id ? (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-2.5 text-center text-sm text-emerald-200">Il tuo piano</p>
              ) : (
                <BuyButton planId={p.id} label={current ? "Cambia da «Gestisci abbonamento»" : "Abbonati"} highlight={Boolean(p.highlight)} enabled={enabled && !current} />
              )}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Sessione extra · {formatEuro(EXTRA_SESSION.priceCents)} + IVA</p>
            <p className="text-sm text-zinc-500">1 sessione da {COMPANIES_PER_SESSION} aziende in più, quando ti serve. Non scade.</p>
          </div>
          <div className="w-full sm:w-56">
            <BuyButton planId="extra" label="Acquista" highlight={false} enabled={enabled} />
          </div>
        </div>
      </Card>
      {!enabled && <p className="text-center text-sm text-zinc-500">I pagamenti online saranno attivi a breve.</p>}

      <Card>
        <h2 className="mb-4 font-semibold text-white">Pagamenti</h2>
        {(purchases ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun pagamento ancora.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {(purchases ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="text-zinc-300">{p.plan === "extra" ? "Sessione extra" : `Abbonamento ${findPlan(p.plan)?.name ?? p.plan}`} · {p.credits} {p.credits === 1 ? "sessione" : "sessioni"}</span>
                <span className="flex items-center gap-3 text-zinc-500">
                  {formatDate(p.created_at)} <Badge tone="green">{formatEuro(p.amount_cents)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
