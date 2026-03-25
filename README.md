# NextClick Studio — AI Skincare/Nutrition Advisor per Shopify

## Stack
- **Backend**: Node.js + Express + Prisma (PostgreSQL) su Railway
- **Frontend**: React + Shopify Polaris (Shopify Embedded App)
- **Widget**: HTML/JS/CSS vanilla (iframe embeddabile sullo store)
- **AI**: Google Gemini 2.5 Flash
- **Billing**: Shopify Billing API

## Struttura
```
nextclick-app/
├── backend/          ← Node.js API (Railway)
│   ├── src/
│   │   ├── routes/   ← auth, config, products, generate, billing, analytics, webhooks, widget
│   │   ├── middleware/
│   │   └── utils/
│   └── prisma/schema.prisma
├── frontend/         ← React + Polaris (Shopify Embedded App)
│   └── src/pages/    ← Dashboard, Design, Copy, Products, AI Persona, Billing, Widget
└── widget/           ← HTML widget (iframe servito dal backend)
    └── index.html
```

## Setup Railway (Backend)

1. Crea un nuovo progetto su Railway
2. Aggiungi un servizio PostgreSQL
3. Crea il servizio backend dal repository
4. Configura le env vars (vedi .env.example)
5. Railway deploy automatico ad ogni push

### Env vars da configurare su Railway:
```
DATABASE_URL=          ← auto da Railway PostgreSQL
SHOPIFY_API_KEY=       ← da Shopify Partners
SHOPIFY_API_SECRET=    ← da Shopify Partners
HOST=                  ← URL Railway del backend (es. https://nextclick-api.railway.app)
GEMINI_API_KEY=        ← da Google AI Studio
SESSION_SECRET=        ← stringa random 32 char
JWT_SECRET=            ← stringa random 32 char
NODE_ENV=production
```

## Setup Shopify App (Partners Dashboard)

1. Vai su partners.shopify.com → Apps → Create app
2. App setup:
   - App URL: `https://YOUR-RAILWAY-URL`
   - Allowed redirection URLs: `https://YOUR-RAILWAY-URL/api/auth/callback`
3. API credentials:
   - Copia API Key e Secret nelle env vars Railway
4. App scopes (nelle impostazioni app):
   - `read_products`
   - `read_orders`
   - `write_script_tags`
   - `read_script_tags`

## Setup Frontend

1. Crea `.env` in `/frontend`:
```
REACT_APP_SHOPIFY_API_KEY=your_api_key
REACT_APP_HOST=https://your-railway-url.railway.app
```

2. Build per produzione:
```bash
cd frontend && npm install && npm run build
```

3. Il backend serve la build React — aggiungi in `backend/src/index.js`:
```js
app.use(express.static(path.join(__dirname, '../../frontend/build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/build/index.html')));
```

## Database Setup

```bash
cd backend
npm install
npx prisma db push    # crea le tabelle
npx prisma generate   # genera il client
```

## Installazione App su Store di Test

1. Vai su Partners Dashboard → Apps → [tua app] → Test on development store
2. Seleziona uno store di sviluppo
3. L'app viene installata → OAuth flow → onboarding wizard

## Piani e Prezzi

| Piano   | Prezzo  | Generazioni | Feature extra |
|---------|---------|-------------|---------------|
| Starter | $49/mese | 1.000      | Prodotti consigliati |
| Pro     | $199/mese | 10.000    | Routine completa + PDF + AI tagging |
| Scale   | $499/mese | 100.000   | Tutto + supporto prioritario |

## Costi operativi stimati

- Railway (backend + DB): ~$20/mese
- Gemini API (per 10k gen): ~$10-30/mese
- **Margine su piano Starter**: ~$20/mese per cliente
- **Margine su piano Pro**: ~$150/mese per cliente

## Shopify App Store Submission

Prima di submittare:
1. [ ] App funziona su store di sviluppo
2. [ ] Privacy Policy URL configurato
3. [ ] App listing completo (screenshots, descrizione, icona)
4. [ ] GDPR webhooks registrati (obbligatori per App Store)
5. [ ] Performance test (generazione < 30s)
6. [ ] Test su mobile
