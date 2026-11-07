# yeppo: map (open only when the task needs it)

## Places
| what | where |
|---|---|
| Live code | `~/Projects/nextclick-saas` (local branch `yeppo-royale`; remote `NextClickStudio/nextclick-saas`, branch `claude/yeppo-royale`) |
| Site + extension | `yeppo-oracle/` (Next.js 15.5, React 19, TS); extension in `yeppo-oracle/extension`, zip `public/yeppo-extension.zip` (v3.3.1) |
| Migrations | `yeppo-royale/supabase/migrations/001…096` (all applied; **next is 097**) |
| Edge functions | `yeppo-royale/supabase/functions/*` (MCP `deploy_edge_function`) |
| Supabase | project ref **`qyobtgubvopzfmomzeuj`**, eu-west-1, Free |
| Vercel | team `team_Wssh2o4gaRAM3ZGRUB2236zt`, project `yeppo` (`prj_JnXtmG6fciPUMYIl0jMyO2V97Um1`), Hobby, domain yeppo.it |
| Dev server | `Desktop/.claude/launch.json` → `yeppo-oracle`, port 3123 (no secrets: guarded calls fail locally) |
| Discord scripts | `discord/` (`api.sh`, `post2.py`, `build.py`, `purge.py`, `assign.py`, `announce.py`; token only in a temporary `.token`, chmod 600, never in git) |

## Code (yeppo-oracle)
- `app/api/read/route.ts` (edge, preferredRegion dub1): the main read. In parallel: creator (`yr_creator_s`), namesakes
  (`wave`), DexScreener, X origin, RugCheck, SOL price, odds → real balances → launch bundle (`lib/launch.ts`) →
  `soldBy`/`seenBuyers` → holder checks → `decide` → `steady()` → Safe/Risky/Danger → odds → `logCall` → thecoin /
  xSignals. Returns risk, hold, watch, clear, odds, thecoin, origin, xs, launch, launchState/launchEta/launchTry,
  boosts, live, decision. No Pro key → `lockedRead`. Never reads the chain itself.
- `app/api/hot/route.ts` (edge, dub1): Hot on X → `yr_hot_s(words, since, mints)`.
- `app/api/meta`, `app/api/health`, `app/api/discord` (nodejs, Ed25519), `app/api/discord/sweep` (Vercel cron 06:15),
  `app/go/[mint]` (redirect to Axiom).
- lib: `access.ts` (DB_HEADERS, accessOf), `decide.ts` (all decision logic), `launch.ts`, `live.ts`, `rugcheck.ts`,
  `odds.ts`/`oddsTable.ts`, `thecoin.ts`, `wave.ts`, `origin.ts`, `xsignals.ts`, `kols.ts`, `j7.ts` (J7Tracker via
  Socket.IO in the browser), `radar.ts` (goodPost/postWeight), `meta.ts`, `pay.ts` (key in `yo:key`), `hooks.ts`
  (usePoll), `discord.ts`.
- components: `CoinPanel.tsx` (whole panel: Loading, TheCoinCard, OriginLine, XLines, OddsRow, Traders, Holders,
  `cp-callchk`, folds, Hot on X), `HotOnX.tsx`, `Nav.tsx`, `Home.tsx`, `Demo.tsx`, `Pricing.tsx`, `ExtensionPage.tsx`.
- Pages: `/`, `/record`, `/pricing`, `/extension`, `/panel` (side-panel iframe), `/c/[mint]`, `/learn`, `/privacy`,
  `/terms`, `/risk`, `/trends` (redirect).
- Extension: `content.js` detects the coin; `background.js` toolbar colour + J7 connect; `panel.html/js` J7 dot;
  `link.js` on yeppo.it hands over key and J7 token.
- Refresh: panel every 3 s on the curve, 10 s otherwise, ×4 slower in background. Caches: read 2.5 s, dex 10 s, money
  60 s; shared odds 30 min, origin 10 min, xsignals 60 s, wave 30 s.

## Data flow
```
pump.fun ─► yr-capture (edge, every 30 s, runs 45 s): logsSubscribe public RPC + PumpPortal
            → yr_ticks (≥0.01 SOL, 20 min) · yr_obirth (launches + sig/slot, 1 d) · yr_grad · backfill · X links
yr_cc_roll (60 s since 092) → yr_cc (one row per coin, 14 d)      yr-fund (2 min) → yr_fund      yr-sm (2 min) → yr_sm3
yr-launch (every min) → yr_launch src 'rpc' (coins ≥50 trades, 15 s–30 min)
yr-launch?mint= (booked by yr_launch_claim) → yr_launch src 'open'
yr-record (:50) → yr_record · yr_x_gc        yr-odds (04:20) → yr_odds
Browser ─► /api/read (Vercel dub1) ─► guarded RPCs + RugCheck + DexScreener + fxtwitter ─► panel
```
- Capture misses truncated-log trades and ~2/3 of creations: holders never from seen trades alone.
- Launch from signature (091): `getSignatureStatuses` → slot → `getBlock` slot0/slot0+1 (accounts mode), 3 calls.
  Public RPC: ~1 getTransaction/s per IP, getBlock ~4 per 10 s per IP. Accuracy identical to Helius (5 coins checked).

## Deploy (each one needs the user's OK first)
- Site: `cd ~/Projects/nextclick-saas/yeppo-oracle && npx tsc --noEmit -p . && npx next build && npx vercel --prod --yes`,
  then `curl -s https://yeppo.it/api/health`.
- Migration: write `yeppo-royale/supabase/migrations/097_name.sql`, MCP `apply_migration` (name `097_name`), check with
  a SELECT. PL/pgSQL: a variable named like a table alias (e.g. `k`) → "column reference is ambiguous".
- Edge function: MCP `deploy_edge_function` with the full `index.ts`, `verify_jwt: false` for cron ones (`x-ingest-key`).
- Extension: bump `extension/manifest.json` + text in `components/ExtensionPage.tsx`, rebuild the zip
  (`zip-extension.sh`), then deploy the site.

## Quick checks
```bash
curl -s https://yeppo.it/api/health          # status ok, tick_age_s low, cron_failed_10m 0
cd ~/Projects/nextclick-saas && git status --short | wc -l && git log --oneline -1
```
```sql
select pg_size_pretty(pg_database_size(current_database()));
select coalesce(src,'old') src, count(*) from yr_launch where t > yr_now()-3600000 group by 1;
select n, final, count(*) from yr_launch_try where t > yr_now()-3600000 group by 1,2;
select word, count(*) from yr_calls group by 1;
-- cron health: filter by time and keep it small, cron.job_run_details can be slow
select j.jobname, d.status, count(*) from cron.job_run_details d join cron.job j using (jobid)
 where d.start_time > now() - interval '15 minutes' group by 1,2;
```
