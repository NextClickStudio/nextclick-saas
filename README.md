# NextClick SaaS Platform

AI Advisor SaaS per brand Shopify.

## Deploy su Railway

### 1. Carica su GitHub
Carica tutti questi file nel repository `nextclick-saas` su GitHub.

### 2. Crea progetto Railway
- railway.app → New Project → Deploy from GitHub → seleziona `nextclick-saas`

### 3. Aggiungi variabili d'ambiente
In Railway → il tuo progetto → Variables, aggiungi:

| Variabile | Valore |
|-----------|--------|
| `GEMINI_API_KEY` | La tua chiave da console.cloud.google.com |
| `SESSION_SECRET` | Una stringa casuale lunga (es. `nc-prod-secret-2024-xyz`) |
| `RAILWAY_PUBLIC_DOMAIN` | Il dominio Railway (es. `nextclick-saas.up.railway.app`) |

### 4. Deploy
Railway fa il deploy automaticamente. In 2-3 minuti il sito è online.

## Struttura

```
/ → Login
/register → Registrazione
/onboarding/step1-5 → Wizard configurazione
/dashboard → Dashboard brand
/dashboard/products → Gestione prodotti
/billing → Abbonamento
/api/generate → Generazione AI (chiamato dal widget)
/api/config/:brandId → Config pubblica per widget
/widget.js → JavaScript del widget (embed su Shopify)
```

## Come usare il widget su Shopify

Il brand incolla questo codice nel tema Shopify:

```html
<script src="https://TUODOMINIO.up.railway.app/widget.js" data-brand="BRAND_ID"></script>
```

Il widget si carica automaticamente con design e personalità AI configurati.

## Piani

- **Recommend** €59/mese → 500 gen/mese → Solo prodotti consigliati
- **Advisor** €199/mese → 2000 gen/mese → Routine completa + prodotti
