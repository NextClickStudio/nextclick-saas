# Maison

Learn fashion, five minutes a day. Next.js + Supabase, deployed on Vercel (yeppo.it).

- **Learn**: a path of 13 units and 46 lessons (colour, fabrics & prints, anatomy of clothes, history,
  the Paris / Italian / London-NY-Tokyo-Antwerp maisons, creative directors, bags-shoes-jewels,
  runway legends, the fashion system, icons & muses, aesthetics and live Google trends).
- **Habits**: XP, daily goal, streaks, hearts (wrong answers come back at the end of the lesson).
- **Duels**: 7 questions, 20 seconds each, against a random player or a friend (share link).
- **Leagues**: weekly and all-time XP boards, from Bronze to Haute Couture.

## Run locally

```
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

## How it fits together

| Where | What |
| --- | --- |
| `src/lib/learn/content.ts` | The whole curriculum: every unit, lesson and question |
| `src/config/learn.ts` | Hearts, XP, daily goal, duel length, leagues |
| `src/lib/learn/store.tsx` | Client state: one `maison_learn_state` call, hearts, the running lesson or duel |
| `src/components/learn/Player.tsx` | The lesson / duel player (choice, true-false, pairs, order, live questions) |
| `supabase/migrations/` | Tables, Row Level Security and the functions that award XP and settle duels |
| `supabase/functions/maison-market` | Reads Google Trends every 10 minutes (used by the live lessons) |

All writes go through Postgres functions (`maison_finish_lesson`, `maison_duel_quick`, `maison_duel_invite`,
`maison_duel_join`, `maison_duel_submit`); clients can only read.
