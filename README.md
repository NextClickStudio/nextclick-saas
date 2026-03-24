# NextClick SaaS

AI-powered product advisor widget for Shopify stores.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

## Project Structure

```
src/
  index.js              # Express app entry point
  routes/
    auth.js             # Login / register pages
    dashboard.js        # Brand dashboard
    onboarding.js       # Setup wizard (5 steps)
    api.js              # Widget API + Shopify sync
    billing.js          # Plan management
    widget.js           # widget.js script served to Shopify
  middleware/
    auth.js             # requireAuth, requirePlan, checkGenerations
  services/
    db.js               # SQLite (better-sqlite3)
data/                   # SQLite DB (git-ignored)
public/                 # Static assets
Procfile                # Railway / Heroku start command
```

## Deploy to Railway

1. Push to GitHub
2. Connect repo in Railway → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway sets `RAILWAY_PUBLIC_DOMAIN` automatically

## Widget embed code

After setup, copy the snippet from your dashboard and paste it into your Shopify theme:

```html
<script src="https://YOUR-APP.up.railway.app/widget.js" data-brand="YOUR-BRAND-ID"></script>
```
