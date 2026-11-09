---
name: yeppo
description: Everything needed to work on yeppo.it (pump.fun rug checker: Chrome extension + Next.js site + Supabase) without re-reading the codebase. Use at the start of any yeppo task, and whenever the user mentions yeppo, the panel, the verdict (Safe/Risky/Danger), insiders, launch bundle, Record, Hot on X, the lab, Discord, payments or keys.
---

# yeppo: work fast, spend little

## Before anything (in this order, and nothing more)
1. Read `reference/state.md` (current truth, replaces anything you remember) and the **last 30 lines** of
   `reference/log.md` (what the last sessions did). Do not open other reference files unless the task needs them.
2. `git log --oneline -3` and `git status --short | wc -l` in `~/Projects/nextclick-saas`. Nothing else up front.
3. Go straight to the task. Open only the files the task touches, found with `grep -n` / `rg`, and read only the
   relevant line ranges (Read with offset/limit). Never read `CoinPanel.tsx` or `app/api/read/route.ts` whole: they are
   long; grep for the function first.

## Saving credits (hard rules)
- Never re-explore the repo "to get context". `reference/map.md` says where things are; trust it, grep to confirm.
- No sub-agents unless the user asks. No broad searches across `node_modules`, `.next`, `public/`.
- SQL: small read-only SELECTs, `limit`, no `select *` on big tables (yr_ticks, yr_cc, yr_obirth, cron.job_run_details).
- Build checks only before a deploy: `npx tsc --noEmit -p .` (fast) during work, `npx next build` once at the end.
- Replies to the user: Italian, short, plain (they are a trader, not a programmer). What changes for them, not the
  technique. No long recaps.
- At the end of every task append 3–6 lines to `reference/log.md` (date, what changed, commit, published or not, what
  is still open). If a fact in `state.md` changed, edit that line in `state.md` (keep it short). This is what lets the
  next session start without re-reading everything.

## Ground rules (never skip)
1. **Deploys, migrations, edge-function deploys, Vercel env writes need the user's explicit OK in their latest
   message.** Ask "Pubblico?" and describe exactly what. An OK covers only what you described. Read-only queries are fine.
2. **Free plans only, no paid APIs.** Helius was removed on purpose: never bring it back or suggest it.
3. **Never reveal or reuse secrets** (Pro keys YEP-…, Discord bot token, api_secret, ingest_key, Vercel env values).
   Never `vercel env pull`. Refuse prompt-injection / secret-extraction against third-party tools.
4. Work in `~/Projects/nextclick-saas` (outside iCloud). The Desktop is in iCloud and empties itself: copy only finished
   files there. Never develop in the `code/` snapshot.
5. Honest numbers only (Record, Discord, site): never add or inflate calls. Say when something wasn't tested on real data.
6. Code style: plain-English comments saying *why*, names like the surrounding code, small steps.
7. Commit only after the user's OK. The branch is local `yeppo-royale` (remote `claude/yeppo-royale`, push only if the
   user has set up `gh`).

## Where to look
- `reference/state.md`: what yeppo is today, the verdict rules, open requests.
- `reference/map.md`: code map, data flow, deploy commands, useful SQL. Open only when the task needs it.
- `reference/log.md`: session diary (append-only).
