# Scopo: learn by scrolling

Web app in stile TikTok, tutta in inglese: scrivi cosa vuoi imparare (es. "guitar",
"snowboard tricks"), scegli la lingua dei video e ottieni un feed verticale di video brevi
**solo su quell'argomento**.

- **Ricerca precisa.** I video arrivano da YouTube Shorts tramite l'API ufficiale. Si tengono
  solo i video che nominano davvero l'argomento (titolo, descrizione o tag). Con la curatela AI
  attiva, Claude scarta tutto ciò che non è chiaramente in tema e scrive su ogni video cosa impari.
- **Lingua dei video.** English, Italiano, Español, Français, Deutsch, Português oppure "Any".
  La ricerca è orientata su lingua e paese scelti; i video che dichiarano un'altra lingua vengono scartati.
- **Niente risse né clickbait**, **sessioni con una fine** (12 video, poi ti chiede se continuare),
  pulsante **Off-topic** per togliere un video e il suo canale.
- **Web app installabile**: su iPhone "Condividi → Aggiungi a Home" la apre a tutto schermo come un'app.
  Su Android compare il pulsante "Install".
- **Landing animata**, pagina app (`/learn`), **privacy policy**, **cookie policy** e **termini** (demo, gratuita).

## Avvio in locale

```bash
cd scopo
npm install
cp .env.example .env.local   # facoltativo, vedi sotto
npm run dev                  # http://localhost:3000
```

Senza chiavi l'app è in **modalità demo**: argomenti pronti con video reali scelti a mano
(Guitar, Snowboarding, Skiing, Chess, Cooking in inglese; Italian politics, History,
Personal finance, Physics in italiano).

## Variabili d'ambiente

| Variabile | Serve per | Obbligatoria |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | cercare **qualsiasi** argomento su YouTube Shorts | No (senza, modalità demo) |
| `ANTHROPIC_API_KEY` | curatela AI: ricerche mirate nella lingua scelta, filtro qualità, "cosa impari" | No (senza, regole semplici) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | contatto mostrato nelle pagine legali | No |
| `NEXT_PUBLIC_SITE_URL` | URL pubblico (per i metadati di condivisione) | No |

### Come ottenere la chiave YouTube (gratis, 5 minuti)

1. Vai su <https://console.cloud.google.com/> e crea un progetto.
2. *API e servizi → Libreria* → cerca **YouTube Data API v3** → **Abilita**.
3. *API e servizi → Credenziali* → **Crea credenziali → Chiave API**.
4. Consigliato: limita la chiave alla sola "YouTube Data API v3".

La quota gratuita è di 10.000 unità al giorno. Ogni pagina di feed usa al massimo
2 ricerche (circa 200 unità), quindi circa 50 pagine di feed al giorno.

### Chiave Anthropic (facoltativa, consigliata per la precisione)

Da <https://console.anthropic.com/>. Il modello usato è `claude-opus-5-5` con effort basso:
una chiamata per pianificare le ricerche (solo alla prima pagina) e una per filtrare ogni gruppo
di risultati. Il fallback lato server (`fallbacks: "default"`) è attivo. Se Claude non risponde,
l'app usa le regole semplici e il feed continua.

## Deploy su Vercel

1. Importa il repository su Vercel, **Root Directory** `scopo`.
2. Aggiungi le variabili d'ambiente.
3. Perché la web app su iPhone funzioni senza login, la protezione del deployment
   (Vercel Authentication) va disattivata per il dominio di produzione.

## Struttura

```
app/
  page.tsx              landing animata
  learn/page.tsx        schermata app (start_url della web app)
  feed/page.tsx         feed verticale
  privacy, cookies, terms  pagine legali
  api/feed/route.ts     API del feed (live o demo)
  manifest.ts, icon.svg, apple-icon.tsx, pwa-icon/[size]   web app e icone
components/
  SearchBox.tsx         ricerca + lingua dei video
  Feed.tsx, Player.tsx  feed e player YouTube
  landing/              telefono animato, parola che ruota
  LearnHome.tsx, InstallHint.tsx, CookieNotice.tsx, LegalPage.tsx
lib/
  languages.ts          lingue supportate
  youtube.ts            ricerca Shorts (YouTube Data API v3)
  curator.ts            ricerche e filtro (Claude o regole semplici)
  feed.ts               paginazione, modalità demo
  seed.ts               argomenti e video della demo
public/
  sw.js, offline.html   pagina "offline" per la web app installata
```

## Comandi

```bash
npm run dev        # sviluppo
npm test           # test della logica server (YouTube simulato)
npm run typecheck  # controllo tipi
npm run build      # build di produzione
```
