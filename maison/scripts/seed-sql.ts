/**
 * Prints the SQL that syncs the database with the code:
 *   - maison_config  ← src/config/game.ts (+ admin emails)
 *   - maison_trends  ← src/lib/cards/catalog.ts (new trends only; existing values are kept)
 *   - with --history: 30 days of starter points for trends that have none
 *
 * Usage: ADMIN_EMAILS=a@b.com npx tsx scripts/seed-sql.ts [--history] > seed.sql
 */
import { GAME_CONFIG } from "../src/config/game";
import { TRENDS, sampleHistory, trendQuery } from "../src/lib/cards/catalog";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const config = {
  pack: GAME_CONFIG.pack,
  rarityMultiplier: GAME_CONFIG.rarityMultiplier,
  market: GAME_CONFIG.market,
  cards: GAME_CONFIG.cards,
  duel: GAME_CONFIG.duel,
  shop: GAME_CONFIG.shop,
  house: GAME_CONFIG.house,
  admins,
};

const out: string[] = [];
out.push(
  `insert into public.maison_config (id, data) values (1, ${q(JSON.stringify(config))}::jsonb) on conflict (id) do update set data = excluded.data;`,
);

const rows = TRENDS.map((t) => {
  const style = t.hex ? { hex: t.hex } : t.material ? { material: t.material } : t.mood ? { mood: t.mood } : {};
  const h = sampleHistory(t.id);
  const v = h[h.length - 1];
  return `(${q(t.id)}, ${q(t.name)}, ${q(t.family)}, ${q(trendQuery(t))}, ${q(JSON.stringify(style))}::jsonb, ${v}, ${h[h.length - 2]})`;
});
out.push(
  `insert into public.maison_trends (id, name, family, query, style, value, day_open) values\n${rows.join(",\n")}\n` +
    `on conflict (id) do update set name = excluded.name, family = excluded.family, query = excluded.query, style = excluded.style;`,
);

if (process.argv.includes("--history")) {
  const rows = TRENDS.map((t) => `(${q(t.id)}, array[${sampleHistory(t.id).join(",")}]::numeric[])`);
  out.push(
    `insert into public.maison_trend_points (trend_id, ts, value, source)\n` +
      `select v.id, date_trunc('day', now()) - make_interval(days => array_length(v.h, 1) - i), v.h[i], 'seed'\n` +
      `from (values\n${rows.join(",\n")}\n) as v(id, h), generate_subscripts(v.h, 1) as i\n` +
      `where not exists (select 1 from public.maison_trend_points p where p.trend_id = v.id)\non conflict do nothing;`,
  );
}

console.log(out.join("\n\n"));
