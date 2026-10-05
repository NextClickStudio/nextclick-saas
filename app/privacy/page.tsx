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
        <li>
          Dati di account: nome e cognome ed email ricevuti dal login con Google, oltre a quelli che inserisci tu (nome
          dell&apos;azienda, ruolo, sito, descrizione dell&apos;offerta, link per prenotare una call).
        </li>
        <li>Dati di utilizzo: sessioni create, descrizioni del prodotto e del target inserite, aziende analizzate, note e stati commerciali.</li>
        <li>Dati di pagamento: gestiti da Stripe; Yeppo riceve solo l&apos;esito del pagamento, l&apos;importo e i dati di fatturazione, mai i dati completi della carta.</li>
        <li>Dati tecnici: indirizzo IP e log necessari alla sicurezza e al funzionamento del Servizio.</li>
        <li>
          Notifiche: se attivi le notifiche sul telefono o sul computer, conserviamo l&apos;indirizzo tecnico di consegna fornito dal
          browser, usato solo per inviarti i promemoria del Radar. Puoi disattivarle in qualsiasi momento.
        </li>
      </ul>
      <h3>Dati relativi alle aziende analizzate</h3>
      <p>
        Il Servizio legge esclusivamente pagine web pubbliche dei siti aziendali, rispettando il file robots.txt. Vengono
        salvati solo il nome dell&apos;azienda, l&apos;indirizzo del sito, l&apos;URL e il titolo delle pagine lette, i punteggi
        dell&apos;analisi e i canali di contatto pubblicati dall&apos;azienda sul proprio sito (es. pagina contatti, WhatsApp
        aziendale, profili social del brand).
      </p>
      <p>
        Per permettere un contatto B2B pertinente individuiamo anche le persone che guidano l&apos;azienda in ruoli
        commerciali (es. fondatore, titolare, responsabile marketing o vendite). Le cerchiamo sul sito dell&apos;azienda e
        tramite una ricerca web su fonti pubbliche (es. pagine &quot;chi siamo&quot;, articoli, profili professionali pubblici),
        effettuata con la ricerca Google integrata nel modello di intelligenza artificiale. Conserviamo solo nome, ruolo
        in azienda, link alla fonte pubblica e gli eventuali profili professionali o canali di contatto aziendali
        pubblicati. Non raccogliamo dati di persone senza un ruolo in azienda, né dati sensibili. La base giuridica è il
        legittimo interesse al contatto professionale B2B (art. 6.1.f GDPR); questi dati sono visibili solo
        all&apos;utente che ha avviato la sessione. Email e numeri di telefono personali trovati nel testo vengono rimossi
        prima dell&apos;analisi e non sono conservati. Chiunque può chiedere la cancellazione dei propri dati scrivendo
        all&apos;indirizzo indicato nella sezione 1.
      </p>
      <h3 id="instagram">Radar e collegamento Instagram</h3>
      <p>
        Se l&apos;utente collega il proprio profilo Instagram professionale (tramite il login ufficiale di Facebook/Meta), Yeppo conserva
        l&apos;identificativo e il nome del profilo e un token di accesso di sola lettura, usati esclusivamente per leggere i post pubblici
        recenti dei profili aziendali, degli hashtag scelti dall&apos;utente e dei nuovi brand del settore individuati dal Radar. Per ogni post selezionato conserviamo link, nome del profilo
        aziendale, didascalia, numero di like e commenti, solo per mostrarli all&apos;utente che li ha cercati. Yeppo non pubblica, non mette
        like e non invia messaggi per conto dell&apos;utente.
      </p>
      <p>
        <strong>Eliminazione dei dati di Instagram:</strong> l&apos;utente può scollegare Instagram in qualsiasi momento dalla pagina Radar
        (&quot;Scollega&quot;): il token viene cancellato subito. Eliminando l&apos;account Yeppo vengono cancellati anche tutti i post salvati
        nel Radar. È possibile chiedere la cancellazione anche scrivendo all&apos;indirizzo indicato nella sezione 1, oppure rimuovendo
        l&apos;app Yeppo dalle impostazioni di Facebook (Impostazioni → App e siti web).
      </p>
      <h3>Visitatori dei report</h3>
      <p>
        Quando un report viene aperto registriamo data e ora dell&apos;apertura, senza profilare il visitatore e senza
        cookie di tracciamento.
      </p>
      <h3>Visitatori del sito</h3>
      <p>
        Per sapere quante persone visitano il sito usiamo Vercel Web Analytics, che conta le visite in forma aggregata e
        anonima, senza cookie e senza identificare il singolo visitatore.
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
        <li>Supabase Inc. (database e autenticazione), con dati ospitati nell&apos;Unione Europea (Irlanda).</li>
        <li>Vercel Inc. (hosting del sito, statistiche anonime delle visite).</li>
        <li>
          Google LLC / Google Ireland: login con Google e modelli di intelligenza artificiale Gemini (con la ricerca Google
          integrata), che ricevono solo i testi necessari ad analizzare i siti, cercare le persone chiave e scrivere i
          messaggi. Usiamo le API a pagamento di Gemini, i cui dati non vengono usati da Google per addestrare i modelli.
        </li>
        <li>Stripe Payments Europe Ltd. (pagamenti e abbonamenti).</li>
        <li>Meta Platforms Ireland Ltd. (collegamento Instagram per il Radar, solo se lo attivi).</li>
        <li>I servizi di notifica del tuo browser o sistema operativo (es. Google, Apple, Mozilla), solo se attivi le notifiche.</li>
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
