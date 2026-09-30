# Zeppo v1

**Trova clienti B2B mostrando alle aziende un problema che possono vedere, non mandando cold email.**

Zeppo individua il "sintomo visibile" del problema che il tuo prodotto risolve, analizza i siti delle aziende del
settore, crea una **classifica pubblica** (solo le migliori, da pubblicare su LinkedIn) e un **report privato** per ogni
azienda con i 3 punti in cui perde clienti. Il report è il motivo per aprire la conversazione.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres) · Google Gemini 2.5 Flash · Vercel.

---

## 1. Database su Supabase

> **Già fatto per `yeppo.it`:** le tabelle sono state create nel progetto Supabase **"yeppo"**
> (`https://djzzjybrcknrvvovvlpq.supabase.co`) insieme al progetto demo. Leggi questa sezione solo se vuoi rifarlo
> da zero in un altro progetto.

1. Vai su [supabase.com](https://supabase.com) → **New project** (regione consigliata: Europe West / Frankfurt).
2. Apri **SQL Editor** → **New query**, incolla tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi
   **Run**.
3. (Facoltativo) Nuova query, incolla [`supabase/seed.sql`](supabase/seed.sql) e premi **Run**: crea il progetto demo
   NextClick con 3 aziende di prova già analizzate (URL finti su `example.com`).

Tutte le tabelle hanno la Row Level Security attiva **senza policy pubbliche**: il browser non può leggere nulla,
solo il server di Zeppo con la chiave segreta. Supabase mostrerà l'avviso informativo "RLS Enabled No Policy": è voluto.

## 2. Le chiavi

| Variabile | Dove si trova |
| --- | --- |
| `SUPABASE_URL` | Supabase → **Project Settings → Data API** (o API) → *Project URL*. Per yeppo: `https://djzzjybrcknrvvovvlpq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → chiave **`service_role`** (tab "Legacy API keys") oppure una **Secret key** `sb_secret_...`. È segreta: non condividerla mai. |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → **Create API key** |
| `ADMIN_PASSWORD` | La scegli tu: la password dell'area riservata. Usane una lunga. |
| `NEXT_PUBLIC_SITE_URL` | L'indirizzo del sito, senza slash finale: `https://yeppo.it` |

## 3. Provare in locale

Serve [Node.js](https://nodejs.org) 20 o più recente.

```bash
npm install
cp .env.example .env.local   # poi apri .env.local e compila i valori
npm run dev
```

Apri <http://localhost:3000> (in locale usa `NEXT_PUBLIC_SITE_URL=http://localhost:3000`).

Altri comandi: `npm test` (test di punteggi e URL), `npm run lint`, `npm run build`.

## 4. Deploy su Vercel (yeppo.it)

Il progetto Vercel si chiama **"yeppo"** ed è già collegato al dominio `yeppo.it`.

1. Vercel → progetto **yeppo** → **Settings → Environment Variables**. Aggiungi le 5 variabili della tabella sopra
   (ambiente: *Production* e *Preview*). Se esistono variabili del vecchio sito che non servono più, puoi eliminarle.
2. **Settings → Git**: collega il repository GitHub `NextClickStudio/nextclick-saas` (production branch: `main`).
   Da quel momento ogni push su `main` pubblica automaticamente il sito.
3. Dopo aver aggiunto o cambiato le variabili serve un nuovo deploy: **Deployments → ⋯ → Redeploy**.
4. Apri `https://yeppo.it` → **Area riservata** → inserisci `ADMIN_PASSWORD`.

Nota: la route di analisi ha `maxDuration = 60` secondi. Con il piano Hobby di Vercel va bene così.

## 5. Quanto costa l'AI

Stima con **Gemini 2.5 Flash** (prezzi di listino al momento dello sviluppo: circa 0,30 $ per milione di token in
ingresso e 2,50 $ per milione in uscita, "ragionamento" incluso — verifica su
[ai.google.dev/pricing](https://ai.google.dev/pricing)):

- una analisi legge fino a 3 pagine (≈ 12.000 token in ingresso) e produce ≈ 3.000-5.000 token in uscita
  → **circa 1,5-2 centesimi per azienda**;
- **30 aziende ≈ 0,50 $** (anche contando qualche nuovo tentativo); la generazione dei criteri costa meno di 1 centesimo.

Con il piano gratuito di Google AI Studio puoi fare le prime prove senza pagare, ma con limiti di richieste al minuto.

## 6. Come si usa (esempio NextClick)

1. **Nuovo progetto** → passo 1: nome, "Cosa vendi" (*widget AI per Shopify che consiglia il prodotto giusto*),
   "A chi lo vendi" (*e-commerce italiani di beauty e integratori*), settore (*Beauty e integratori Italia*).
   C'è il pulsante "Usa l'esempio NextClick" per precompilare.
2. Passo 2 → **Trova il sintomo**: l'AI propone il sintomo (es. *"il sito non aiuta il cliente indeciso a scegliere
   tra tanti prodotti"*), il nome della classifica e 6-10 criteri con peso. Modificali, poi **Salva progetto**.
3. Tab **Aziende**: incolla una lista `Nome, https://sito.it` (una per riga) o carica un CSV `nome,url` →
   **Anteprima** → **Importa**. Massimo 200 per volta; duplicati e indirizzi non validi vengono scartati.
4. Tab **Analisi** → **Analizza tutte le aziende non ancora analizzate**. Le aziende vengono analizzate una alla volta
   (20-40 secondi l'una): tieni aperta la pagina. Puoi interrompere quando vuoi.
5. Tab **Classifica**: vista "Classifica" (i migliori in alto) e "Priorità prospect" (sintomo più forte in alto =
   chi contattare per primo). Esporta CSV, copia il link del report di ogni azienda.
6. Tab **Pubblicazione**: attiva la classifica pubblica, scegli la top N, imposta testo e link della CTA (es.
   Calendly) e il nome del mittente. Copia il link della classifica e pubblicalo su LinkedIn.
7. Scrivi a mano all'azienda (es. su LinkedIn) con il link al suo report e metti lo stato su **Contattata**.
   Quando apre il report, lo stato passa da solo a **Ha aperto il report** e la visita compare nello storico.
8. Aggiorna lo stato (ha risposto, chiamata, cliente…) e le note dalla tabella o dalla pagina dell'azienda.

Il progetto demo (se hai eseguito `seed.sql`) ha una classifica pubblica di prova su `/classifica/demonextclick`
e un report di esempio su `/r/demoVitaInt002`.

## 7. Decisioni prese in autonomia

- **`proxy.ts` invece di `middleware.ts`**: in Next.js 16 il file `middleware.ts` è stato rinominato `proxy.ts`
  (stessa funzione). Protegge `/app` e `/api/admin`.
- **Nome dell'indice**: aggiunta la colonna `projects.index_name` (es. "Indice della consulenza online"), proposta
  dall'AI insieme al sintomo e modificabile. Il titolo della classifica è "*nome indice* — *settore*".
- **Visite al report**: registrate con una funzione SQL atomica (`register_report_view`) che incrementa il contatore,
  salva l'evento e passa lo stato da "contattata" a "report aperto". Non contano le aperture da area riservata
  (cookie di login) né quelle di bot e anteprime link (LinkedIn, WhatsApp, Slack…), che altrimenti gonfierebbero i numeri.
- **Pari merito**: stessa posizione (1, 2, 2, 4), a parità di punteggio ordine alfabetico.
- **Crawler**: redirect seguiti a mano controllando ogni tappa; bloccati localhost, IP privati e domini che risolvono
  su IP privati. Se robots.txt non esiste o non si carica, si procede. Dopo 25 secondi non si visitano altre pagine
  interne, per restare nei 60 secondi insieme all'AI. Email e numeri di telefono vengono tolti dal testo prima di
  inviarlo all'AI; nel database si salvano solo URL e titolo delle pagine.
- **Siti costruiti solo in JavaScript** (testo quasi assente nell'HTML): analisi in errore con messaggio chiaro.
- **Validazione AI**: se Gemini non restituisce un punteggio per ogni criterio, la risposta è considerata non valida e
  si riprova una volta.
- **Criteri modificati dopo le analisi**: i vecchi punteggi restano; l'interfaccia avvisa di rianalizzare.
- **Test**: scritti con il test runner integrato di Node (`node --test`), senza librerie in più.
- **Eliminazione**: si possono eliminare singole aziende e interi progetti (con conferma scritta "ELIMINA").
- **Database condiviso**: il progetto Supabase "yeppo" conteneva già le tabelle `maison_*` del sito precedente.
  Non sono state toccate (i nomi non si sovrappongono): se non servono più si possono eliminare dal Table Editor.

## 8. Cosa NON c'è in questa versione

- Invio automatico di email o messaggi (voluto: il contatto lo fai tu).
- Più utenti / account: c'è una sola password di amministrazione.
- Analisi in background: la coda gira nel browser, quindi la pagina deve restare aperta.
- Siti che mostrano il contenuto solo tramite JavaScript (serve un browser vero, non incluso).
- Immagini Open Graph generate automaticamente (ci sono titolo e descrizione, non l'immagine).
- Storico dei punteggi nel tempo (vale solo l'ultima analisi completata).

## Struttura

```
app/
  page.tsx                          landing
  login/                            accesso area riservata
  r/[slug]/page.tsx                 report privato
  classifica/[publicSlug]/page.tsx  classifica pubblica
  app/                              area riservata (progetti, wizard, tab, dettaglio azienda)
  api/admin/...                     API protette (criteria, projects, import, analyze, companies, export)
  api/auth/login|logout
components/                         componenti grafici scritti a mano
lib/
  ai.ts        chiamate Gemini + schemi + prompt (modello in GEMINI_MODEL)
  crawler.ts   robots.txt, fetch sicuro, estrazione testo con cheerio
  db.ts        client Supabase server-only
  data.ts      letture riusate (aziende + analisi + report + posizioni)
  scoring.ts   media ponderata e posizioni
  url.ts       normalizzazione URL e import
  auth.ts      firma/verifica cookie (HMAC)
proxy.ts       protezione /app e /api/admin
supabase/schema.sql, supabase/seed.sql
tests/         test di scoring e URL
```
