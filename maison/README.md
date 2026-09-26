# Maison

The stock market of fashion, as a card game. Mobile-first web app (Next.js + Tailwind, later Supabase + Vercel).

Every card is a **trend** (a piece, colour, material, detail or aesthetic) with a market index that moves
every day. Players open a daily pack, put five cards on their runway, and their maison's revenue follows
the market. Cards are contracts: they expire, and can be sold early.

## Run it

```
npm install
npm run dev      # http://localhost:3000/lab
```

## Where things live

| Path | What |
| --- | --- |
| `src/config/game.ts` | Every game number: pack odds, rarity multipliers, card lifespan, sell fee, duel rewards |
| `src/lib/cards/catalog.ts` | Trend catalogue, demo market data, card value / sell value |
| `src/lib/cards/materials.ts` | Fabric textures for Material cards (SVG patterns) |
| `src/components/TrendCard.tsx` | The card (front, back, flip, rarity finishes) |
| `src/app/lab/` | Lab page: maison dashboard, duel, movers, runway, every card |

Market numbers in the lab are demo data (`sampleHistory`). Real values come from the database in Phase 1–2.
