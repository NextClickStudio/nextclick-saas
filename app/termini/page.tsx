import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Termini e condizioni" };

export default function TermsPage() {
  return (
    <LegalPage title="Termini e condizioni">
      <p>
        Questi termini regolano l&apos;uso di Yeppo (il &quot;Servizio&quot;), fornito da {LEGAL.owner}, {LEGAL.address},
        P.IVA {LEGAL.vat} (il &quot;Fornitore&quot;). Creando un account accetti questi termini e la{" "}
        <Link href="/privacy">Privacy policy</Link>.
      </p>

      <h2>1. Il Servizio</h2>
      <p>
        Yeppo è uno strumento di prospezione commerciale B2B: individua aziende potenzialmente interessate all&apos;offerta
        dell&apos;utente, analizza le pagine pubbliche dei loro siti con l&apos;ausilio dell&apos;intelligenza artificiale, genera
        punteggi, classifiche e report, e suggerisce canali di contatto pubblicati dalle aziende stesse.
      </p>
      <p>
        Il Servizio è destinato esclusivamente a professionisti e imprese (B2B). Non è destinato ai consumatori.
      </p>

      <h2>2. Account</h2>
      <ul>
        <li>Devi fornire dati veritieri e custodire le credenziali di accesso. Sei responsabile di ogni attività svolta con il tuo account.</li>
        <li>Puoi eliminare l&apos;account in qualsiasi momento; le sessioni non utilizzate non sono rimborsabili salvo quanto previsto al punto 4.</li>
      </ul>

      <h2>3. Sessioni, piani e pagamenti</h2>
      <ul>
        <li>Ogni nuovo account riceve una sessione di prova gratuita con un numero limitato di aziende.</li>
        <li>I piani sono pacchetti prepagati di sessioni, senza rinnovo automatico. I prezzi sono indicati IVA esclusa.</li>
        <li>Una sessione si considera utilizzata nel momento in cui viene avviata la ricerca delle aziende.</li>
        <li>I pagamenti sono gestiti da Stripe. La fattura viene emessa ai dati inseriti in fase di pagamento.</li>
      </ul>

      <h2>4. Rimborsi</h2>
      <p>
        Trattandosi di un servizio digitale B2B fornito immediatamente, non è previsto il diritto di recesso dei
        consumatori. Le sessioni non utilizzate possono essere rimborsate su richiesta entro 14 giorni dall&apos;acquisto
        scrivendo a {LEGAL.email}. In caso di malfunzionamento del Servizio che renda inutilizzabile una sessione, la
        sessione viene riaccreditata.
      </p>

      <h2>5. Uso corretto e responsabilità dell&apos;utente</h2>
      <ul>
        <li>
          L&apos;utente è l&apos;unico responsabile dei contatti che avvia con le aziende e del rispetto delle norme
          applicabili, incluse quelle su protezione dei dati, comunicazioni commerciali e concorrenza (GDPR, Codice
          Privacy, Codice del Consumo ove applicabile).
        </li>
        <li>È vietato usare il Servizio per inviare spam, molestie, contenuti ingannevoli o diffamatori, o per finalità illecite.</li>
        <li>È vietato tentare di eludere i limiti del Servizio, rivenderlo senza autorizzazione o usarlo per analizzare reti o sistemi non pubblici.</li>
        <li>Le classifiche pubbliche e i report devono essere presentati come analisi basate su criteri dichiarati, senza alterarne i risultati.</li>
      </ul>

      <h2>6. Natura dei risultati</h2>
      <p>
        Le analisi sono generate automaticamente, anche tramite intelligenza artificiale, sulla base delle sole pagine
        pubbliche lette in un dato momento. Possono contenere errori o imprecisioni e non costituiscono consulenza
        professionale. L&apos;utente è tenuto a verificarle prima di utilizzarle o condividerle.
      </p>

      <h2>7. Proprietà intellettuale</h2>
      <p>
        Il software, il marchio Yeppo e i contenuti del Servizio sono di proprietà del Fornitore. I contenuti inseriti
        dall&apos;utente restano suoi; l&apos;utente concede al Fornitore la licenza necessaria a erogare il Servizio.
      </p>

      <h2>8. Disponibilità e limitazione di responsabilità</h2>
      <p>
        Il Servizio è fornito &quot;così com&apos;è&quot;. Il Fornitore si impegna a garantirne la continuità ma non risponde di
        interruzioni dovute a terzi o a cause di forza maggiore. Salvo dolo o colpa grave, la responsabilità del
        Fornitore è limitata all&apos;importo pagato dall&apos;utente nei 12 mesi precedenti l&apos;evento.
      </p>

      <h2>9. Modifiche</h2>
      <p>
        Il Fornitore può modificare questi termini dandone comunicazione con almeno 15 giorni di preavviso. L&apos;uso
        continuato del Servizio dopo tale data vale come accettazione.
      </p>

      <h2>10. Legge applicabile e foro</h2>
      <p>
        Si applica la legge italiana. Per ogni controversia è competente in via esclusiva il foro della sede del
        Fornitore.
      </p>

      <h2>11. Contatti</h2>
      <p>
        {LEGAL.email} · PEC {LEGAL.pec}
      </p>
    </LegalPage>
  );
}
