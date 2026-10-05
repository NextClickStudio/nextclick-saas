import Link from "next/link";
import { planActive } from "@/lib/plans";
import { availableSessions, type Account } from "@/lib/supabase-auth";

/** Avviso in cima all'app quando serve un'azione sul piano: prova finita, sessioni esaurite, pagamento non riuscito. */
export default function PlanBanner({ account }: { account: Account }) {
  if (account.unlimited) return null;
  const active = planActive(account.plan_status);
  const sessions = availableSessions(account);

  let text = "";
  let cta = "";
  let tone: "warn" | "info" = "info";
  if (account.plan_status === "past_due" || account.plan_status === "unpaid") {
    text = "Il pagamento del tuo abbonamento non è andato a buon fine: aggiorna la carta per non perdere il piano.";
    cta = "Aggiorna pagamento";
    tone = "warn";
  } else if (!active && sessions === 0) {
    text = "Hai usato la prova gratuita. Scegli un piano per trovare altre aziende, scrivere i messaggi e usare il Radar ogni giorno.";
    cta = "Scegli un piano";
  } else if (active && sessions === 0) {
    text = "Hai usato tutte le sessioni di questo mese. Aggiungi una sessione extra o passa a un piano più grande.";
    cta = "Vedi le opzioni";
  }
  if (!text) return null;

  return (
    <div
      className={`no-print border-b ${tone === "warn" ? "border-red-400/20 bg-red-500/10" : "border-accent/20 bg-accent/10"}`}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
        <p className={tone === "warn" ? "text-red-100" : "text-zinc-100"}>{text}</p>
        <Link href="/app/piani" className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-zinc-200">
          {cta} →
        </Link>
      </div>
    </div>
  );
}
