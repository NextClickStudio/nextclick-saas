# Yeppo

**Trova clienti B2B senza cold email.** Yeppo trova le aziende giuste per chi vende B2B, analizza i loro siti, crea un
report personalizzato per ognuna e indica il canale diretto migliore per fargliela arrivare.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres + Auth) · Vercel AI Gateway
oppure Google Gemini diretto (attualmente in uso, piano gratuito) · Stripe · Vercel.

## Come funziona per l'utente

1. **Registrazione** (`/registrati`): l'account include **1 sessione di prova** fino a 10 aziende.
2. **Nuova sessione**: descrive cosa vende, il cliente ideale, il settore, l'area geografica e la dimensione delle
   aziende (piccole, medie, grandi, tutte).
3. L'AI trova il **sintomo visibile** e lo trasforma in 6-10 **criteri** modificabili.
4. **Avvio** (usa 1 sessione): Yeppo **cerca sul web** le aziende adatte, scarta marketplace e directory e **verifica**
   che ogni sito risponda. Si possono aggiungere aziende anche a mano. Massimo 30 aziende per sessione (10 per la prova).
5. **Analisi**: per ogni azienda legge fino a 3 pagine pubbliche, assegna i punteggi con prove, trova i 3 punti deboli
   e raccoglie i **canali di contatto** pubblicati sul sito (chat, WhatsApp, Instagram, LinkedIn aziendale, pagina
   partner/B2B, pagina contatti…).
6. **Contatti**: per ogni azienda, in ordine di priorità, il canale consigliato, i passi da seguire e l'aggancio
   personalizzato. Il primo contatto è sempre il report gratuito, mai una vendita.
7. **Report privato** (`/r/...`) e **classifica pubblica** (`/classifica/...`), con conteggio delle aperture.
8. **Piani** (`/app/piani`): pacchetti di sessioni prepagate con Stripe, senza abbonamento.

## Configurazione

### Variabili d'ambiente (Vercel → Settings → Environment Variables)

| Variabile | Obbligatoria | Dove si trova |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | sì | Supabase → Project Settings → API Keys → `service_role` |
| `STRIPE_SECRET_KEY` | per i pagamenti | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | per i pagamenti | Stripe → Developers → Webhooks (vedi sotto) |
| `STRIPE_AUTOMATIC_TAX` | no | `1` per far calcolare l'IVA a Stripe Tax |
| `AI_MODEL`, `DISCOVERY_MODEL` | no | modelli AI Gateway (predefiniti `google/gemini-2.5-flash` e `perplexity/sonar-pro`) |
| `GEMINI_API_KEY` | consigliata | chiave di Google AI Studio: se c'è, tutta l'AI usa Gemini diretto (modelli provati in ordine: gemini-3.5-flash, gemini-3.8-flash, gemini-flash-lite-latest) |
| `GEMINI_MODEL` | no | forza un solo modello Gemini |
| `AI_GATEWAY_API_KEY` | solo in locale | Vercel → AI Gateway → API Keys (su Vercel l'AI funziona senza chiavi) |

URL Supabase, chiave pubblica di login e indirizzo del sito hanno già valori predefiniti (progetto "yeppo", `https://yeppo.it`).

### Stripe

1. Crea l'account Stripe e attivalo (dati aziendali, IBAN).
2. Developers → API keys → copia la **Secret key** in `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → **Add endpoint** `https://yeppo.it/api/stripe/webhook`, eventi
   `checkout.session.completed` e `checkout.session.async_payment_succeeded` → copia il **Signing secret** in
   `STRIPE_WEBHOOK_SECRET`.
4. Prezzi e numero di sessioni dei piani si cambiano in `lib/plans.ts`.

### Supabase

Lo schema è già applicato al progetto "yeppo". Per un progetto nuovo: SQL Editor → incolla `supabase/schema.sql` → Run.
Per dare sessioni illimitate a un utente (es. il tuo account):
`update accounts set unlimited = true where user_id = (select id from auth.users where email = 'tua@email.it');`

Per l'email di recupero password conviene configurare un SMTP proprio (Supabase → Authentication → Emails → SMTP,
es. Resend): quello incluso ha limiti molto bassi. In Authentication → URL Configuration imposta
**Site URL** `https://yeppo.it` e aggiungi `https://yeppo.it/auth/callback` tra i Redirect URLs.

### Dati legali

Completa i campi `[DA COMPLETARE]` in `lib/legal.ts` (ragione sociale, indirizzo, P.IVA, email, PEC): compaiono nel
footer e nelle pagine `/privacy`, `/termini`, `/cookie`. I testi sono un modello di partenza: falli verificare da un
professionista prima del lancio commerciale.

## Costi AI stimati (AI Gateway)

- Ricerca aziende: circa 0,03-0,08 $ per ricerca (Perplexity Sonar Pro).
- Analisi: circa 1,5-2 centesimi per azienda (Gemini 2.5 Flash).
- Una sessione completa da 30 aziende ≈ **0,60-0,80 $** di AI, contro un prezzo di vendita di 8-13 € a sessione.

Saldo e consumi: Vercel → AI Gateway. Limiti di sicurezza: al massimo 2 analisi per azienda in media per sessione.

## Sviluppo locale

```bash
npm install
cp .env.example .env.local   # compila SUPABASE_SERVICE_ROLE_KEY e AI_GATEWAY_API_KEY
npm run dev
```

Comandi: `npm test` (punteggi e URL), `npm run lint`, `npm run build`.

## Struttura

```
app/
  page.tsx                       landing (tema scuro, animazioni)
  privacy, termini, cookie       pagine legali
  login, registrati, password-dimenticata, reimposta-password, auth/callback
  app/                           area utenti: dashboard, sessioni, piani, account
  r/[slug]                       report privato per l'azienda
  classifica/[publicSlug]        classifica pubblica (solo top N)
  api/app/...                    API protette (sessioni, ricerca, analisi, import, export, checkout, account)
  api/auth/...                   registrazione, login, logout, recupero password
  api/stripe/webhook             accredito sessioni dopo il pagamento
lib/
  ai.ts          prompt e chiamate AI (sintomo, valutazione + piano di contatto, ricerca aziende)
  crawler.ts     robots.txt, fetch sicuro, estrazione testo e canali di contatto
  supabase-auth.ts  login utenti e account/crediti
  stripe.ts      Checkout e verifica webhook
  plans.ts       piani e prezzi
  legal.ts       dati legali del titolare
proxy.ts         protezione di /app e /api/app
supabase/schema.sql
```

## Decisioni prese

- **Registrazione senza conferma email**: l'account si crea subito (meno attrito). La prova gratuita è limitata a
  10 aziende per contenere eventuali abusi. Si può attivare la conferma email più avanti, con un SMTP proprio.
- **Isolamento dei dati**: il database resta accessibile solo dal server; ogni API verifica che sessione e aziende
  appartengano all'utente collegato.
- **Ricerca aziende**: il modello con ricerca web propone i candidati, ma entrano in lista solo i siti verificati.
  Se il modello di ricerca non è disponibile si usa il modello standard (sempre con verifica dei siti).
- **Canali di contatto**: si raccolgono solo i canali aziendali pubblicati sul sito (link e tipo), mai email o
  telefoni personali.
- **Visite ai report**: non contano le aperture di chi ha creato la sessione né quelle di bot e anteprime link.
- **Nessun cookie di profilazione**: niente banner cookie necessario.
