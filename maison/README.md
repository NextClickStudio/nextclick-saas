# Maison

A fashion collectible card game. Mobile-first web app (Next.js + Tailwind, later Supabase + Vercel).

## Phase 0 — Atelier Lab

`/lab` shows 50 procedurally generated garments. Every garment is drawn from a **seed**:
same seed = same garment, so a card only needs to store a few bytes.

```
npm install
npm run dev              # http://localhost:3000/lab
npm run check:determinism
```

### Where things live

| Path | What |
| --- | --- |
| `src/config/game.ts` | Every game number (rarity odds, how extreme each rarity is…) |
| `src/lib/garment/generate.ts` | Seed → garment parameters (silhouette, sleeves, colour, material…) |
| `src/lib/garment/parts/*` | The drawing parts: body, top, sleeves, skirt, trousers, outerwear, details |
| `src/lib/garment/palette.ts` | Curated fashion colours |
| `src/lib/garment/render.ts` | Parameters → SVG (materials, finishes, hand-drawn filter) |
| `src/app/lab/` | The lab page |

Every part hangs on fixed anchor points of the figure (`parts/body.ts`), so a generated
part can later be replaced by a hand-drawn SVG part without touching the rest.
