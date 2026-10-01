# Zeppo v1

**Trova clienti B2B mostrando alle aziende un problema che possono vedere, non mandando cold email.**

Zeppo individua il "sintomo visibile" del problema che il tuo prodotto risolve, analizza i siti delle aziende del
settore, crea una **classifica pubblica** (solo le migliori, da pubblicare su LinkedIn) e un **report privato** per ogni
azienda con i 3 punti in cui perde clienti. Il report è il motivo per aprire la conversazione.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres) · Gemini 2.5 Flash tramite Vercel AI Gateway (crediti gratuiti) · Vercel.

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

Su Vercel servono **solo due variabili**:

| Variabile | Dove si trova |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API Keys** → chiave **`service_role`** (tab "Legacy API keys") oppure una **Secret key** `sb_secret_...`. È segreta: non condividerla mai. |
| `ADMIN_PASSWORD` | La scegli tu: la password dell'area riservata. Usane una lunga. |

Facoltative: `SUPABASE_URL` (predefinito: il progetto "yeppo"), `NEXT_PUBLIC_SITE_URL` (es. `https://yeppo.it`),
`AI_MODEL` (modello AI Gateway, predefinito `google/gemini-2.5-flash`), `GEMINI_API_KEY` (per usare Gemini diretto).

### L'AI: Vercel AI Gateway (gratis per iniziare)

Zeppo usa **Vercel AI Gateway**, che dà a ogni account dei **crediti gratuiti ogni mese** e su Vercel funziona
**senza chiavi** (il progetto si autentica da solo). Il modello predefinito è Gemini 2.5 Flash; si cambia con
`AI_MODEL` (es. `openai/gpt-5-mini`, `google/gemini-2.5-flash-lite` per spendere ancora meno).
Saldo e consumi: Vercel → **AI Gateway**. Se i crediti finiscono, l'analisi mostra un messaggio chiaro.
Se un giorno attivi la fatturazione Google, basta impostare `GEMINI_API_KEY` e Zeppo userà Gemini direttamente.

## 3. Provare in locale

Serve [Node.js](https://nodejs.org) 20 o più recente.

```bash
npm install
cp .env.example .env.local   # compila SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD e AI_GATEWAY_API_KEY
npm run dev
```

Apri <http://localhost:3000> (in locale usa `NEXT_PUBLIC_SITE_URL=http://localhost:3000`).

Altri comandi: `npm test` (test di punteggi e URL), `npm run lint`, `npm run build`.

## 4. Deploy su Vercel (yeppo.it)

Il progetto Vercel si chiama **"yeppo"** ed è già collegato al dominio `yeppo.it`.

1. Vercel → progetto **yeppo** → **Settings → Environment Variables**. Aggiungi `SUPABASE_SERVICE_ROLE_KEY` e
   `ADMIN_PASSWORD` (ambiente: *Production* e *Preview*). Elimina le variabili del vecchio sito che non servono più.
2. **Settings → Git**: collega il repository GitHub `NextClickStudio/nextclick-saas` (production branch: `main`).
   Se Vercel non vede il repository, installa l'app Vercel su GitHub per l'organizzazione NextClickStudio.
   Da quel momento ogni push su `main` pubblica automaticamente il sito.
3. Dopo aver aggiunto o cambiato le variabili serve un nuovo deploy: **Deployments → ⋯ → Redeploy**.
4. Apri `https://yeppo.it` → **Area riservata** → inserisci `ADMIN_PASSWORD`.

Nota: la route di analisi ha `maxDuration = 60` secondi. Con il piano Hobby di Vercel va bene così.

## 5. Quanto costa l'AI

Stima con **Gemini 2.5 Flash** (circa 0,30 $ per milione di token in ingresso e 2,50 $ in uscita, "ragionamento"
incluso; prezzi aggiornati su Vercel → AI Gateway → Models):

- una analisi legge fino a 3 pagine (≈ 12.000 token in ingresso) e produce ≈ 3.000-5.000 token in uscita
  → **circa 1,5-2 centesimi per azienda**;
- **30 aziende ≈ 0,50 $**, quindi rientrano ampiamente nei crediti gratuiti mensili di AI Gateway;
- con `AI_MODEL=google/gemini-2.5-flash-lite` il costo scende di circa 4-5 volte.

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

- **AI tramite Vercel AI Gateway**: Gemini diretto ora richiede un account di fatturazione Google; AI Gateway usa
  lo stesso modello con i crediti gratuiti Vercel e senza chiavi. Gemini diretto resta disponibile con `GEMINI_API_KEY`.
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
- **Database ripulito**: dal progetto Supabase "yeppo" sono stati eliminati tabelle, funzioni, job pianificati e utenti
  del sito precedente ("maison"). Restano solo le tabelle di Zeppo.

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
  ai.ts        chiamate AI (AI Gateway o Gemini) + schemi + prompt (modello in GATEWAY_MODEL/GEMINI_MODEL)
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
