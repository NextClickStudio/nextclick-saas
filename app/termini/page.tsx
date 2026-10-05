import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";
import { COMPANIES_PER_FREE_SESSION, EXTRA_SESSION, FREE_RADAR_RUNS, formatEuro, PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Termini e condizioni" };

export default function TermsPage() {
  return (
    <LegalPage title="Termini e condizioni">
      <p>
        Questi termini regolano l&apos;uso di Yeppo (il &quot;Servizio&quot;), fornito da {LEGAL.owner}, {LEGAL.address}
        {LEGAL.vat ? `, P.IVA ${LEGAL.vat}` : ""} (il &quot;Fornitore&quot;). {LEGAL.project} Creando un account accetti questi termini e la{" "}
        <Link href="/privacy">Privacy policy</Link>.
      </p>

      <h2>1. Il Servizio</h2>
      <p>
        Yeppo è uno strumento di prospezione commerciale B2B: individua aziende potenzialmente interessate all&apos;offerta
        dell&apos;utente, analizza le pagine pubbliche dei loro siti con l&apos;ausilio dell&apos;intelligenza artificiale, genera
        punteggi, classifiche e report, cerca le persone chiave e i canali di contatto pubblicati, e propone bozze di
        messaggi e follow-up che l&apos;utente decide se e come inviare.
      </p>
      <p>
        Il &quot;Radar&quot; è una funzione facoltativa che, collegando un account Instagram professionale tramite le API ufficiali di
        Meta, individua brand e post pubblici del settore scelto e propone bozze di commenti. Nessun contenuto viene
        pubblicato automaticamente: la pubblicazione è sempre fatta dall&apos;utente.
      </p>
      <p>
        Il Servizio è destinato esclusivamente a professionisti e imprese (B2B). Non è destinato ai consumatori.
      </p>

      <h2>2. Account</h2>
      <ul>
        <li>Devi fornire dati veritieri e custodire le credenziali di accesso. Sei responsabile di ogni attività svolta con il tuo account.</li>
        <li>
          Puoi eliminare l&apos;account in qualsiasi momento dalla pagina Account. Se hai un abbonamento attivo, disdicilo prima
          dal portale di gestione: l&apos;eliminazione dell&apos;account non dà diritto a rimborsi del periodo già pagato.
        </li>
      </ul>

      <h2>3. Prova gratuita, abbonamenti e pagamenti</h2>
      <ul>
        <li>
          Ogni nuovo account riceve una prova gratuita: una sessione fino a {COMPANIES_PER_FREE_SESSION} aziende e{" "}
          {FREE_RADAR_RUNS} ricerche Radar. La prova non richiede carta e non si trasforma da sola in un abbonamento.
        </li>
        <li>
          I piani sono abbonamenti mensili ({PLANS.map((p) => `${p.name} ${formatEuro(p.priceCents)}`).join(", ")} al mese), con le
          sessioni e le ricerche Radar indicate nella pagina Piani. I prezzi sono IVA esclusa.
        </li>
        <li>
          <strong>Rinnovo automatico:</strong> l&apos;abbonamento si rinnova ogni mese alla stessa data e l&apos;importo viene
          addebitato sul metodo di pagamento salvato, finché non viene disdetto.
        </li>
        <li>
          <strong>Sessioni del mese:</strong> a ogni rinnovo le sessioni incluse nel piano ripartono da capo. Le sessioni del mese non
          usate non si accumulano sul mese successivo e non sono rimborsabili.
        </li>
        <li>
          <strong>Sessioni extra:</strong> si possono acquistare in qualsiasi momento a {formatEuro(EXTRA_SESSION.priceCents)} l&apos;una
          (pagamento singolo, senza rinnovo) e non scadono.
        </li>
        <li>Una sessione si considera utilizzata nel momento in cui viene avviata la ricerca delle aziende.</li>
        <li>
          <strong>Disdetta:</strong> puoi disdire quando vuoi, senza penali, dal pulsante &quot;Gestisci abbonamento&quot; nella pagina
          Piani. Il piano resta attivo fino alla fine del mese già pagato e poi non si rinnova.
        </li>
        <li>
          <strong>Cambio piano:</strong> dalla pagina Piani puoi passare a un altro piano in qualsiasi momento. Se passi a un
          piano superiore paghi subito la differenza per i giorni rimasti del mese e ricevi subito le sessioni in più; se passi
          a un piano inferiore la differenza resta come credito sui rinnovi successivi e le sessioni del mese scendono al
          massimo previsto dal nuovo piano.
        </li>
        <li>
          Se un pagamento non va a buon fine, Stripe riprova l&apos;addebito per alcuni giorni; se non riesce, l&apos;abbonamento viene
          sospeso fino all&apos;aggiornamento del metodo di pagamento.
        </li>
        <li>I pagamenti sono gestiti da Stripe. La ricevuta o fattura viene emessa ai dati inseriti in fase di pagamento.</li>
        <li>
          Il Fornitore può modificare prezzi e contenuti dei piani dandone comunicazione con almeno 30 giorni di preavviso;
          le modifiche valgono dal primo rinnovo successivo e puoi disdire prima che si applichino.
        </li>
      </ul>

      <h2>4. Rimborsi</h2>
      <p>
        Trattandosi di un servizio digitale B2B fornito immediatamente, non è previsto il diritto di recesso dei
        consumatori. Il primo mese di abbonamento e le sessioni extra non utilizzate possono essere rimborsati su
        richiesta entro 14 giorni dall&apos;acquisto, se non è stata avviata nessuna sessione, scrivendo a {LEGAL.email}. In caso
        di malfunzionamento del Servizio che renda inutilizzabile una sessione, la sessione viene riaccreditata.
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
        <li>
          Per il Radar l&apos;utente si impegna a rispettare i termini di Instagram e di Meta: i commenti vanno pubblicati a mano,
          devono essere pertinenti e non possono essere usati per spam o messaggi ripetitivi.
        </li>
        <li>
          Per evitare abusi l&apos;uso dell&apos;intelligenza artificiale ha limiti giornalieri ragionevoli per account, indicati
          nell&apos;app quando vengono raggiunti.
        </li>
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
        {LEGAL.email}{LEGAL.pec ? ` · PEC ${LEGAL.pec}` : ""}
      </p>
    </LegalPage>
  );
}
