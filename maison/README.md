# Maison

The stock market of fashion, as a card game. Next.js + Supabase, deployed on Vercel (yeppo.it).

Every card is a **trend** (a piece, colour, material, detail or aesthetic). Its index moves every hour
with Google search interest. Players open a free pack every day, put five cards on their runway, sell
whenever they want (take profit or cut loss) and face another maison in a daily duel.

## Run locally

```
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

## How it fits together

| Where | What |
| --- | --- |
| `src/config/game.ts` | Every game number. After changing it run `ADMIN_EMAILS=you@x.com npm run seed:sql` and apply the SQL (the server enforces the same numbers from `maison_config`). |
| `src/lib/cards/catalog.ts` | The trend catalogue and the Google search keyword for each trend |
| `supabase/migrations/` | Database: tables, Row Level Security, game functions (packs, selling, duels), cron jobs |
| `supabase/functions/maison-market` | Edge Function run every 10 minutes: reads Google Trends and moves each index |
| `src/app/(game)/` | Home (maison dashboard + duel), Market, Pack opening, Cards, Ranks |
| `src/app/admin` | Market desk: override values, CSV import, force an update |
| `src/app/lab` | Card design lab with demo data |

## Game rules on the server

All writes go through Postgres functions (`maison_open_pack`, `maison_sell_card`, `maison_set_runway`,
`maison_buy_pack`, `maison_create_house`); clients can only read. `maison_daily_rollover` runs at 00:02 UTC:
expired cards are auto-sold, duels are settled and paid, new duels are paired from the locked runways.
