// What X says about a coin beyond its link, from yeppo's own records (yr_xlink) and the free fxtwitter mirror:
//  * the same X account linked by other coins, and how they ended: a creator who changes wallet but keeps the account
//  * the same post linked by other coins: how many coins one post started, and whether this one came first
//  * how fast the post is spreading: likes and reposts a minute, from two reads a minute or more apart
// The X links of the coin and of its namesakes are recorded as they are read (a few short rows per coin opened).
// Worked out once a minute per coin on each server.
import { DB_HEADERS } from "./access";
import { SUPABASE_URL } from "./config";
import { linkOf, type Origin, postNow } from "./origin";

export type XSignals = {
  /** the author scorecard: coins born from this author's posts, how many ran, how many died fast, the best */
  author: { handle: string; coins: number; x2: number; x5: number; dead: number; best: [string | null, number] | null } | null;
  account: { coins: number; bad: number; last: [string | null, number][] } | null;
  post: { coins: number; rank: number } | null;
  spread: { likes: number; reposts: number; likesMin: number; repostsMin: number; mins: number } | null;
};

async function rpc<T>(fn: string, body: unknown, ms = 2000): Promise<T | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: DB_HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, { t: number; v: XSignals }>();
const pending = new Map<string, Promise<XSignals>>();
const samples = new Map<string, { t: number; likes: number; reposts: number }>(); // post -> its first read here

async function build(mint: string, t0: number | null, o: Origin, namesakes: string[]): Promise<XSignals> {
  // record the X links of this coin and of its namesakes yeppo hasn't read yet
  const need = (await rpc<[string, string, number][]>("yr_xlink_need", { p_mints: namesakes.filter((m) => m !== mint).slice(0, 29) })) ?? [];
  const links = await Promise.all(need.slice(0, 12).map(async ([m, uri, t]) => ({ mint: m, t, ...(await linkOf(uri)) })));
  const rows = [{ mint, handle: o.kind === "post" || o.kind === "account" ? o.handle : null, post: o.post, t: t0 ?? Date.now() }, ...links];
  await rpc("yr_xlink_put", { p_rows: rows });
  const st = await rpc<{ handle: { coins: number; bad: number; last: [string | null, number][] | null } | null; post: { coins: number; rank: number } | null }>(
    "yr_xlink_stats",
    { p_mint: mint, p_handle: o.kind === "account" || o.kind === "post" ? o.handle : null, p_post: o.post },
  );
  const card =
    o.kind === "post" && o.handle
      ? await rpc<{ coins: number; x2: number; x5: number; dead: number; best: [string | null, number] | null } | null>("yr_author_card", { p_handle: o.handle, p_mint: mint })
      : null;
  // how fast the post spreads: against the first read of it on this server
  let spread: XSignals["spread"] = null;
  if (o.post) {
    const now = await postNow(o.handle, o.post);
    if (now) {
      const first = samples.get(o.post);
      if (!first) {
        if (samples.size > 3000) samples.clear();
        samples.set(o.post, { t: Date.now(), likes: now.likes, reposts: now.reposts });
      }
      const mins = first ? (Date.now() - first.t) / 60_000 : 0;
      spread = {
        likes: now.likes,
        reposts: now.reposts,
        likesMin: first && mins >= 1 ? (now.likes - first.likes) / mins : 0,
        repostsMin: first && mins >= 1 ? (now.reposts - first.reposts) / mins : 0,
        mins: Math.round(mins),
      };
    }
  }
  return {
    author: card && o.handle ? { handle: o.handle, ...card } : null,
    account: st?.handle && st.handle.coins > 0 ? { coins: st.handle.coins, bad: st.handle.bad, last: st.handle.last ?? [] } : null,
    post: st?.post && st.post.coins > 1 ? st.post : null,
    spread,
  };
}

/** the X signals of a coin: once a minute, waiting at most waitMs (the next read has them) */
export async function xSignals(mint: string, t0: number | null, o: Origin | null, namesakes: string[], waitMs = 1500): Promise<XSignals | null> {
  if (!o || o.kind === "none") return null;
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  let p = pending.get(mint);
  if (!p) {
    p = build(mint, t0, o, namesakes).catch(() => ({ author: null, account: null, post: null, spread: null })).then((v) => {
      if (cache.size > 2000) cache.clear();
      cache.set(mint, { t: Date.now(), v });
      pending.delete(mint);
      return v;
    });
    pending.set(mint, p);
  }
  return Promise.race([p, new Promise<XSignals | null>((r) => setTimeout(() => r(hit?.v ?? null), waitMs))]);
}
