/**
 * Prints the SQL that syncs the database with the code:
 *   - maison_config  ← src/config/game.ts (+ admin emails)
 *   - maison_trends  ← src/data/trends.ts (new trends are added unlisted; existing prices are kept)
 *
 * New trends get their real price history from Google Trends (the market function
 * back-fills 30 days, then lists them). Nothing is simulated.
 *
 * Usage: ADMIN_EMAILS=a@b.com npx tsx scripts/seed-sql.ts > seed.sql
 */
import { GAME_CONFIG } from "../src/config/game";
import { TRENDS } from "../src/data/trends";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const ids = new Set<string>();
for (const t of TRENDS) {
  if (ids.has(t.id)) throw new Error(`duplicate trend id ${t.id}`);
  ids.add(t.id);
}

const out: string[] = [];
out.push(
  `insert into public.maison_config (id, data) values (1, ${q(JSON.stringify({ ...GAME_CONFIG, admins }))}::jsonb) on conflict (id) do update set data = excluded.data;`,
);

const rows = TRENDS.map((t) => {
  const style = t.hex ? { hex: t.hex } : t.material ? { material: t.material } : t.mood ? { mood: t.mood } : {};
  return `(${q(t.id)}, ${q(t.name)}, ${q(t.family)}, ${q(t.query)}, ${q(JSON.stringify(style))}::jsonb)`;
});
out.push(
  `insert into public.maison_trends (id, name, family, query, style) values\n${rows.join(",\n")}\n` +
    `on conflict (id) do update set name = excluded.name, family = excluded.family, query = excluded.query, style = excluded.style;`,
);

console.error(`${TRENDS.length} trends`);
console.log(out.join("\n\n"));
