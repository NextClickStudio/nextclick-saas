import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Questa informativa descrive come vengono trattati i dati personali degli utenti di Yeppo (il &quot;Servizio&quot;),
        ai sensi del Regolamento (UE) 2016/679 (&quot;GDPR&quot;) e del D.Lgs. 196/2003 e successive modifiche.
      </p>

      <h2>1. Titolare del trattamento</h2>
      <p>
        {LEGAL.owner}, {LEGAL.address}{LEGAL.vat ? `, P.IVA ${LEGAL.vat}` : ""}. Email: {LEGAL.email}{LEGAL.pec ? ` · PEC: ${LEGAL.pec}` : ""}. {LEGAL.project}
      </p>

      <h2>2. Dati trattati</h2>
      <h3>Dati degli utenti registrati</h3>
      <ul>
        <li>Dati di account: nome e cognome, email, nome dell&apos;azienda (facoltativo), password (conservata in forma cifrata).</li>
        <li>Dati di utilizzo: sessioni create, descrizioni del prodotto e del target inserite, aziende analizzate, note e stati commerciali.</li>
        <li>Dati di pagamento: gestiti da Stripe; Yeppo riceve solo l&apos;esito del pagamento, l&apos;importo e i dati di fatturazione, mai i dati completi della carta.</li>
        <li>Dati tecnici: indirizzo IP e log necessari alla sicurezza e al funzionamento del Servizio.</li>
      </ul>
      <h3>Dati relativi alle aziende analizzate</h3>
      <p>
        Il Servizio legge esclusivamente pagine web pubbliche dei siti aziendali, rispettando il file robots.txt. Vengono
        salvati solo il nome dell&apos;azienda, l&apos;indirizzo del sito, l&apos;URL e il titolo delle pagine lette, i punteggi
        dell&apos;analisi e i canali di contatto pubblicati dall&apos;azienda sul proprio sito (es. pagina contatti, WhatsApp
        aziendale, profili social del brand). Se il sito dell&apos;azienda presenta pubblicamente le persone che la guidano (es.
        fondatore, responsabile marketing o commerciale), conserviamo solo nome, ruolo e i profili professionali o social che
        il sito stesso collega a quella persona, per permettere un contatto B2B pertinente (legittimo interesse). Non
        cerchiamo dati personali su altre fonti. Email e altri numeri di telefono vengono rimossi dal testo prima
        dell&apos;analisi e non sono conservati. Chiunque può chiedere la cancellazione dei propri dati scrivendo
        all&apos;indirizzo indicato nella sezione 1.
      </p>
      <h3>Radar (contenuti pubblici)</h3>
      <p>
        Su richiesta dell&apos;utente, il Radar cerca tramite Google contenuti pubblici recenti (post, annunci di lavoro, notizie) legati
        al settore indicato. Per ogni risultato conserviamo il link, la piattaforma, il nome dell&apos;autore o dell&apos;azienda come
        appare pubblicamente e un breve estratto, solo per mostrarli all&apos;utente che li ha cercati. Non accediamo a contenuti privati
        e non pubblichiamo nulla per conto dell&apos;utente. Chi desidera la rimozione può scrivere all&apos;indirizzo indicato nella
        sezione 1.
      </p>
      <h3>Visitatori dei report</h3>
      <p>
        Quando un report viene aperto registriamo data e ora dell&apos;apertura, senza profilare il visitatore e senza
        cookie di tracciamento.
      </p>

      <h2>3. Finalità e basi giuridiche</h2>
      <ul>
        <li>Fornire il Servizio e gestire l&apos;account (esecuzione del contratto, art. 6.1.b GDPR).</li>
        <li>Gestire pagamenti, fatturazione e obblighi fiscali (obbligo di legge, art. 6.1.c).</li>
        <li>Sicurezza, prevenzione degli abusi e analisi dei siti aziendali pubblici (legittimo interesse, art. 6.1.f).</li>
        <li>Rispondere alle richieste di assistenza (esecuzione del contratto o legittimo interesse).</li>
      </ul>

      <h2>4. Fornitori e destinatari</h2>
      <p>I dati sono trattati da fornitori nominati responsabili del trattamento (art. 28 GDPR):</p>
      <ul>
        <li>Supabase (database e autenticazione), con dati ospitati nell&apos;Unione Europea (Irlanda).</li>
        <li>Vercel Inc. (hosting e infrastruttura AI Gateway).</li>
        <li>Fornitori di modelli di intelligenza artificiale tramite Vercel AI Gateway (es. Google), che ricevono solo il testo necessario all&apos;analisi.</li>
        <li>Stripe (pagamenti).</li>
      </ul>
      <p>
        Alcuni fornitori possono trattare dati fuori dallo Spazio Economico Europeo: in tal caso il trasferimento avviene
        sulla base di decisioni di adeguatezza (es. EU-US Data Privacy Framework) o di Clausole Contrattuali Standard.
      </p>

      <h2>5. Conservazione</h2>
      <ul>
        <li>Dati di account e di utilizzo: finché l&apos;account è attivo; eliminati entro 30 giorni dalla cancellazione dell&apos;account.</li>
        <li>Dati di fatturazione: 10 anni, come previsto dalla legge.</li>
        <li>Log tecnici: al massimo 12 mesi.</li>
      </ul>

      <h2>6. I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al trattamento
        (artt. 15-22 GDPR) scrivendo a {LEGAL.email}. Puoi eliminare il tuo account in qualsiasi momento dalla pagina
        &quot;Account&quot;. Hai diritto di proporre reclamo al Garante per la protezione dei dati personali
        (www.garanteprivacy.it).
      </p>
      <p>
        Se la tua azienda è stata analizzata e desideri che i relativi dati vengano rimossi, scrivi a {LEGAL.email}:
        provvederemo alla cancellazione.
      </p>

      <h2>7. Cookie</h2>
      <p>
        Yeppo usa solo cookie tecnici necessari. Dettagli nella <Link href="/cookie">Cookie policy</Link>.
      </p>
    </LegalPage>
  );
}
