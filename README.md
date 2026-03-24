# NextClick SaaS

AI Advisor widget per Shopify — consiglia prodotti e genera routine personalizzate.

## Setup locale

```bash
npm install
cp .env.example .env
# compila .env con le tue chiavi
npm run dev
```

## Deploy su Railway

1. Crea progetto su [railway.app](https://railway.app)
2. Connetti questo repo GitHub
3. Aggiungi le variabili d'ambiente da `.env.example`
4. Aggiungi un **Volume** montato su `/data` (per il DB SQLite)
5. Railway fa il deploy automatico

## Struttura

```
src/
  index.js          # Entry point, configurazione Express + sessioni
  routes/
    auth.js         # Login, register, logout
    dashboard.js    # Dashboard brand
    onboarding.js   # Setup wizard (5 step)
    api.js          # API generate + prodotti + Shopify sync
    widget.js       # Serve widget.js al frontend Shopify
    billing.js      # Gestione abbonamento
  middleware/
    auth.js         # requireAuth, requirePlan, checkGenerations
  services/
    db.js           # SQLite init e getter
public/             # Asset statici
data/               # DB SQLite (gitignored, creato al runtime)
```

## Widget su Shopify

Dopo l'onboarding, copia lo snippet dalla dashboard e incollalo in:
**Shopify Admin → Online Store → Themes → Edit code → `layout/theme.liquid`** prima di `</body>`.

```html
<script src="https://TUO-DOMINIO.up.railway.app/widget.js" data-brand="IL-TUO-BRAND-ID"></script>
```
