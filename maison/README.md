# Maison

The fashion trend market, as a card game. Next.js + Supabase, deployed on Vercel (yeppo.it).

Every card is a real **fashion trend** (~300 of them in 8 families: pieces, shoes, accessories, colours,
fabrics & prints, details, aesthetics, beauty). Its price follows Google search interest, live.

- **Daily pack**: five free cards, rarer ones are worth up to 2×. The streak improves the odds.
- **Market**: buy any listed trend, sell any card (5% fee). Prices update in the app in real time.
- **Forecast**: five trends a day, call rise or fall; a right call pays after 24 hours.
- **Seasons**: everyone starts a week with 10,000 cr; the richest maison wins, top 3 get a trophy.
- **Archive**: every trend you ever pulled from a pack, kept forever.

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
| `src/data/trends.ts` | The trend catalogue and the Google search keyword for each trend (seed only) |
| `src/lib/game/store.tsx` | The whole game on the client: one `maison_state` call, live prices (Realtime), instant actions |
| `supabase/migrations/` | Database: tables, Row Level Security, game functions, cron jobs |
| `supabase/functions/maison-market` | Edge Function run every 10 minutes: lists new trends from their real 30-day Google history, then moves prices |
| `src/app/(game)/` | Today, Market, Pack, Maison (cards + archive), Ranks |
| `src/app/admin` | Market desk: override values, CSV import, force an update |

Every page is static and reads from the client store, so tabs switch instantly; the only server route
is `/auth/callback` (Google sign-in).

## Game rules on the server

All writes go through Postgres functions (`maison_open_pack`, `maison_buy_pack`, `maison_buy_trend`,
`maison_sell_card`, `maison_call`, `maison_create_house`); clients can only read.
`maison_settle_calls` runs hourly; `maison_daily_rollover` runs at 00:02 UTC (snapshots, new market day,
season end and trophies).
