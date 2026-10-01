import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { COMPANIES_PER_FREE_SESSION, PLANS, formatEuro } from "@/lib/plans";
import { getCheckout, paymentsEnabled } from "@/lib/stripe";
import { availableSessions, getAccount, getCurrentUser } from "@/lib/supabase-auth";
import { formatDate } from "@/lib/types";
import BuyButton from "./buy-button";

export const metadata: Metadata = { title: "Piani" };

type Props = { searchParams: Promise<{ session_id?: string; annullato?: string; esaurite?: string }> };

export default async function PlansPage({ searchParams }: Props) {
  const user = (await getCurrentUser())!;
  const { session_id, annullato, esaurite } = await searchParams;

  // ritorno da Stripe: conferma subito il pagamento (il webhook lo farebbe comunque)
  let notice: { tone: "green" | "amber"; text: string } | null = null;
  if (session_id && paymentsEnabled()) {
    try {
      const { data: purchase } = await db()
        .from("purchases")
        .select("user_id, status")
        .eq("stripe_session_id", session_id)
        .maybeSingle();
      if (purchase && purchase.user_id === user.id) {
        const checkout = await getCheckout(session_id);
        if (checkout.payment_status === "paid") {
          await db().rpc("complete_purchase", { p_stripe_session: session_id });
          notice = { tone: "green", text: "Pagamento completato: le sessioni sono state aggiunte al tuo account. Grazie!" };
        } else {
          notice = { tone: "amber", text: "Pagamento in elaborazione: le sessioni compariranno appena confermato." };
        }
      }
    } catch (err) {
      console.error("Verifica pagamento", err);
    }
  }
  if (annullato) notice = { tone: "amber", text: "Pagamento annullato. Nessun addebito." };
  if (esaurite) notice = { tone: "amber", text: "Hai usato tutte le sessioni disponibili. Scegli un piano per continuare." };

  const account = await getAccount(user.id);
  const sessions = availableSessions(account);
  const { data: purchases } = await db()
    .from("purchases")
    .select("id, plan, credits, amount_cents, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  const enabled = paymentsEnabled();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Piani</h1>
        <p className="mt-2 text-zinc-400">
          Hai <strong className="text-white">{sessions === Infinity ? "sessioni illimitate" : `${sessions} ${sessions === 1 ? "sessione" : "sessioni"}`}</strong>
          {account.free_sessions > 0 && ` (inclusa 1 sessione di prova fino a ${COMPANIES_PER_FREE_SESSION} aziende)`}. Nessun abbonamento: le sessioni non scadono.
        </p>
      </div>

      {notice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${notice.tone === "green" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
          {notice.text}
        </div>
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
              <span className="ml-1 text-sm font-normal text-zinc-500">+ IVA</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">{p.perSession}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-zinc-300">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><span className="text-cyan">✓</span>{f}</li>
              ))}
            </ul>
            <div className="mt-7">
              <BuyButton planId={p.id} highlight={Boolean(p.highlight)} enabled={enabled} />
            </div>
          </div>
        ))}
      </div>
      {!enabled && <p className="text-center text-sm text-zinc-500">I pagamenti online saranno attivi a breve.</p>}

      <Card>
        <h2 className="mb-4 font-semibold text-white">I tuoi acquisti</h2>
        {(purchases ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun acquisto ancora.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] text-sm">
            {(purchases ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="text-zinc-300">{PLANS.find((x) => x.id === p.plan)?.name ?? p.plan} · {p.credits} sessioni</span>
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
