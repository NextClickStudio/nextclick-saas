# Scopo: learn by scrolling

Web app in stile TikTok, tutta in inglese, ma al posto di un feed infinito c'è un **percorso
ordinato**: scrivi cosa vuoi imparare (es. "guitar", "snowboard"), scegli la lingua dei video,
dici cosa sai già e Scopo costruisce i passi dalle basi all'avanzato, **partendo da dove sei**.
I progressi si salvano da soli: riprendi esattamente dal video in cui ti eri fermato.

- **Scansione di cosa sai già.** Livello (Brand new, Basics, Intermediate, Advanced) più una frase
  libera ("I can link turns, but I've never tried an ollie"). Con la curatela AI, Claude disegna i
  passi e decide da dove partire; senza AI, il livello e le parole chiave dei passi bastano per la demo.
- **Percorso a passi.** Ogni passo ha 2–5 video brevi in ordine. Nella mappa del percorso puoi segnare
  i passi che conosci e ripartire da qualsiasi punto.
- **Player a passi.** Scheda del passo → video → "passo completato" → prossimo passo. Barra di
  avanzamento divisa per passi. Pulsante **Off-topic** per togliere un video e il suo canale.
- **Libreria.** Tutti i percorsi salvati sul dispositivo, con la percentuale fatta e "Continue".
- **Lingua dei video**: English, Italiano, Español, Français, Deutsch, Português oppure "Any".
- **Web app installabile**, landing animata, privacy policy, cookie policy e termini (demo, gratuita).

## Avvio in locale

```bash
cd scopo
npm install
cp .env.example .env.local   # facoltativo, vedi sotto
npm run dev                  # http://localhost:3000
```

Senza chiavi l'app è in **modalità demo**: percorsi pronti con video reali scelti a mano e messi
in ordine (Guitar in 7 passi, Snowboarding in 7, Chess in 5, poi Skiing, Knife skills in inglese;
Italian politics, History, Personal finance, Physics in italiano).

## Variabili d'ambiente

| Variabile | Serve per | Obbligatoria |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | percorsi per **qualsiasi** argomento, con i video cercati su YouTube Shorts | No (senza, modalità demo) |
| `ANTHROPIC_API_KEY` | percorso su misura disegnato da Claude, lettura di "cosa sai già", scelta dei video di ogni passo | No (senza, passi generici dalle basi all'avanzato) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | contatto mostrato nelle pagine legali | No |
| `NEXT_PUBLIC_SITE_URL` | URL pubblico (per i metadati di condivisione) | No |

### Come ottenere la chiave YouTube (gratis, 5 minuti)

1. Vai su <https://console.cloud.google.com/> e crea un progetto.
2. *API e servizi → Libreria* → cerca **YouTube Data API v3** → **Abilita**.
3. *API e servizi → Credenziali* → **Crea credenziali → Chiave API**.
4. Consigliato: limita la chiave alla sola "YouTube Data API v3".

La quota gratuita è di 10.000 unità al giorno. I video di un passo si cercano solo quando ci
arrivi (al massimo 2 ricerche, circa 200 unità) e poi restano salvati nel percorso: circa 50 passi
al giorno, per tutti gli utenti insieme.

### Chiave Anthropic (facoltativa, consigliata per la precisione)

Da <https://console.anthropic.com/>. Il modello usato è `claude-opus-5-5`: una chiamata (effort
medio) per disegnare il percorso e capire da dove partire, poi una (effort basso) per scegliere i
video di ogni passo. Il fallback lato server (`fallbacks: "default"`) è attivo. Se Claude non risponde,
l'app usa le regole semplici e il feed continua.

## Deploy su Vercel

1. Importa il repository su Vercel, **Root Directory** `scopo`.
2. Aggiungi le variabili d'ambiente.
3. Perché la web app su iPhone funzioni senza login, la protezione del deployment
   (Vercel Authentication) va disattivata per il dominio di produzione.

## Struttura

```
app/
  page.tsx                landing animata
  learn/page.tsx          home dell'app (start_url della web app)
  path/new/page.tsx       scansione: livello + cosa sai già
  path/[id]/page.tsx      mappa del percorso
  path/[id]/play/page.tsx player a passi
  library/page.tsx        percorsi salvati
  api/path/route.ts       costruisce il percorso (demo, AI o passi generici)
  api/step/route.ts       video di un passo (YouTube + curatela)
  privacy, cookies, terms pagine legali
  manifest.ts, icon.svg, apple-icon.tsx, pwa-icon/[size]   web app e icone
components/
  ScanFlow, PathOverview, PathPlayer, VideoSlide, Library, PathCard, TabBar, LearnHome
  paths.ts                salvataggio dei percorsi sul dispositivo (localStorage)
lib/
  paths.ts                tipi del percorso, livelli, "da dove partire"
  curriculum.ts           percorso demo, generico o disegnato da Claude
  feed.ts                 video per un passo, con cursore senza stato
  curator.ts              filtro dei video (Claude o regole semplici)
  youtube.ts              ricerca Shorts (YouTube Data API v3)
  seed.ts                 percorsi e video della demo
```

## Comandi

```bash
npm run dev        # sviluppo
npm test           # test della logica server (YouTube simulato)
npm run typecheck  # controllo tipi
npm run build      # build di produzione
```
