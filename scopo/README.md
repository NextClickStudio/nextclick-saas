# Scopo: scrolla con uno scopo

Web app in stile TikTok: scrivi cosa vuoi imparare (es. "politica italiana") e ottieni
un feed verticale di video brevi **solo su quell'argomento**.

- **Solo il tuo argomento.** I video arrivano da YouTube Shorts tramite l'API ufficiale,
  cercati con più ricerche mirate e mescolati, così il feed resta vario ma sempre in tema.
- **Niente risse né clickbait.** Un filtro scarta i video fatti per far arrabbiare. Con la
  curatela AI attiva, Claude tiene solo i video che spiegano davvero qualcosa e mostra su
  ognuno *cosa impari*.
- **Sessioni con una fine.** Dopo 12 video il feed si ferma e ti chiede se continuare.
- **Fuori tema?** Un tocco e il video sparisce, insieme agli altri dello stesso canale.

## Avvio in locale

```bash
cd scopo
npm install
cp .env.example .env.local   # facoltativo, vedi sotto
npm run dev                  # http://localhost:3000
```

Senza chiavi l'app parte in **modalità demo**: 5 argomenti pronti (Politica italiana,
Storia, Finanza personale, Scienza, Inglese) con video reali scelti a mano.

## Le chiavi (in `.env.local` o nelle variabili d'ambiente di Vercel)

| Variabile | Serve per | Obbligatoria |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | cercare **qualsiasi** argomento su YouTube Shorts | No (senza, modalità demo) |
| `ANTHROPIC_API_KEY` | curatela AI: ricerche mirate, filtro qualità, "cosa impari" | No (senza, regole semplici) |

### Come ottenere la chiave YouTube (gratis, 5 minuti)

1. Vai su <https://console.cloud.google.com/> e crea un progetto.
2. *API e servizi → Libreria* → cerca **YouTube Data API v3** → **Abilita**.
3. *API e servizi → Credenziali* → **Crea credenziali → Chiave API**.
4. Consigliato: limita la chiave alla sola "YouTube Data API v3".

La quota gratuita è di 10.000 unità al giorno. Ogni pagina di feed usa al massimo
2 ricerche (circa 200 unità), quindi circa 50 pagine di feed al giorno.
Per andare oltre si chiede un aumento di quota a Google.

### Chiave Anthropic (facoltativa)

Da <https://console.anthropic.com/>. Il modello usato è `claude-opus-5-5` con effort
basso: una chiamata breve per pianificare le ricerche (solo alla prima pagina) e una per
filtrare ogni gruppo di risultati di YouTube. Il fallback lato server (`fallbacks: "default"`) è attivo:
se una richiesta venisse rifiutata, l'API la ripete su un altro modello. Se Claude non
risponde, l'app usa le regole semplici e il feed continua.

## Deploy su Vercel

1. Importa il repository su Vercel.
2. In **Root Directory** scegli `scopo`.
3. Aggiungi `YOUTUBE_API_KEY` (e se vuoi `ANTHROPIC_API_KEY`) nelle Environment Variables.
4. Deploy.

## Come funziona

```
Browser                         Server (Next.js)                     Esterno
───────                         ────────────────                     ───────
/feed?t=politica  ──GET /api/feed?topic=…──▶  1ª pagina:
                                              • ricerca "secca" sull'argomento ─▶ YouTube Data API
                                              • in parallelo pianifica 6 ricerche ─▶ Claude (facoltativo)
                                              • tiene solo video ≤ 3 min, non live,
                                                incorporabili
                                              • filtra e ordina ──────────────────▶ Claude (facoltativo)
                  ◀── video + cursore ──────
scroll…           ──GET … &cursor=… ───────▶  pagine successive: ruota tra le
                                              ricerche pianificate (feed vario)
```

- Il server non tiene stato: le ricerche pianificate e i token di pagina viaggiano nel
  cursore (`lib/cursor.ts`).
- Il player è la YouTube IFrame API, senza controlli, in loop come TikTok. Un velo
  trasparente sopra l'iframe lascia passare lo scroll e trasforma il tocco in play/pausa.
- Se il browser blocca l'autoplay con audio, il video riparte muto e compare
  "Tocca per l'audio".
- I video non più disponibili o non incorporabili vengono saltati automaticamente.

### Struttura

```
app/
  page.tsx            home: "Cosa vuoi imparare?"
  feed/page.tsx       feed verticale
  api/feed/route.ts   API del feed (live o demo)
components/
  Home.tsx            ricerca, idee, argomenti recenti
  Feed.tsx            scroll a scatti, sessione, fine sessione, "fuori tema"
  Player.tsx          player YouTube
lib/
  youtube.ts          ricerca Shorts (YouTube Data API v3)
  curator.ts          pianificazione ricerche e filtro (Claude o regole semplici)
  feed.ts             paginazione tra più ricerche, modalità demo
  seed.ts             argomenti e video della demo
```

## Comandi

```bash
npm run dev        # sviluppo
npm test           # test della logica server (YouTube simulato)
npm run typecheck  # controllo tipi
npm run build      # build di produzione
```

## Perché non TikTok direttamente?

TikTok non offre API per cercare video o modificare la For You di un utente, e automatizzare
un account viola i suoi Termini. YouTube invece ha un'API di ricerca ufficiale e permette
di incorporare i video. Idee per i prossimi passi:

- video TikTok incorporati da una lista curata (embed ufficiale, senza ricerca automatica);
- account utente con argomenti salvati e progressi;
- quiz di 1 domanda ogni tanto, per fissare quello che hai visto.
