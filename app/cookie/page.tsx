import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie policy" };

export default function CookiePage() {
  return (
    <LegalPage title="Cookie policy">
      <p>
        Yeppo utilizza esclusivamente cookie tecnici, necessari al funzionamento del sito. Non usiamo cookie di
        profilazione, pubblicitari o di analisi di terze parti: per questo non è richiesto il consenso e non mostriamo
        un banner (Linee guida del Garante Privacy del 10 giugno 2021).
      </p>

      <h2>Cookie utilizzati</h2>
      <ul>
        <li>
          <strong>sb-*-auth-token</strong> (Supabase) — mantiene l&apos;accesso all&apos;area riservata dopo il login.
          Durata: fino al logout o alla scadenza della sessione.
        </li>
      </ul>

      <h2>Pagamenti</h2>
      <p>
        Durante il pagamento vieni reindirizzato su Stripe, che può usare propri cookie tecnici e antifrode secondo la
        propria informativa.
      </p>

      <h2>Come gestirli</h2>
      <p>
        Puoi cancellare i cookie dalle impostazioni del browser; in tal caso dovrai effettuare di nuovo l&apos;accesso.
      </p>

      <h2>Contatti</h2>
      <p>{LEGAL.email}</p>
    </LegalPage>
  );
}
