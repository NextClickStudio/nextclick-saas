// Where a coin comes from on X, for every coin opened: the X link its creator put in its metadata (or on DexScreener),
// and who is behind it, from the free public fxtwitter / vxtwitter mirrors (no X account or key):
//  * a post: the coin was born from it (author, followers, account age, text). A big account's post the creator
//    doesn't own is the classic "riding" a famous post;
//  * an account: the coin's own X (followers, how old it is: a few days old with few followers is a throwaway);
//  * a community, or nothing.
// Kept 10 minutes per coin on each server (metadata never changes); the first read waits at most 1.5 s for it, the
// next reads have it.

export type Origin = {
  kind: "post" | "account" | "community" | "none";
  url: string | null;
  handle: string | null;
  followers: number | null;
  /** when the X account was created (ms) */
  joined: number | null;
  /** when the post was written (ms), and its text */
  at: number | null;
  text: string | null;
  verified: boolean;
  /** the post's id, and its likes, reposts, replies and views when it was read */
  post: string | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  views: number | null;
  website: string | null;
  telegram: string | null;
};

type Meta = { twitter?: string; website?: string; telegram?: string };
const NONE: Origin = {
  kind: "none", url: null, handle: null, followers: null, joined: null, at: null, text: null, verified: false,
  post: null, likes: null, reposts: null, replies: null, views: null, website: null, telegram: null,
};

const cache = new Map<string, { t: number; v: Origin }>();
const pending = new Map<string, Promise<Origin>>();

const clean = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim().slice(0, 300) : null);

async function json<T>(url: string, ms: number): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function build(uri: string | null, socials: { type?: string; url?: string }[], websites: { url?: string }[]): Promise<Origin> {
  // the metadata the creator wrote (pump.fun's JSON on IPFS), else what DexScreener lists
  const meta = uri ? await json<Meta>(uri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/"), 2000) : null;
  const twitter = clean(meta?.twitter) ?? clean(socials.find((s) => s.type === "twitter")?.url);
  const website = clean(meta?.website) ?? clean(websites[0]?.url);
  const telegram = clean(meta?.telegram) ?? clean(socials.find((s) => s.type === "telegram")?.url);
  const o: Origin = { ...NONE, website, telegram, url: twitter };
  if (!twitter) return o;
  let u: URL;
  try {
    u = new URL(twitter);
  } catch {
    return o;
  }
  if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return o;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "i" && parts[1] === "communities") return { ...o, kind: "community" };
  const status = parts.indexOf("status");
  if (status > 0 && /^\d+$/.test(parts[status + 1] ?? "")) {
    const id = parts[status + 1];
    const p = await json<{ tweet?: { text?: string; created_timestamp?: number; likes?: number; retweets?: number; replies?: number; views?: number | null; author?: { screen_name?: string; followers?: number; joined?: string; verification?: { verified?: boolean } } } }>(
      `https://api.fxtwitter.com/${parts[0] === "i" ? "i" : parts[0]}/status/${id}`,
      2500,
    );
    const a = p?.tweet?.author;
    return {
      ...o,
      kind: "post",
      handle: a?.screen_name ?? (parts[0] !== "i" ? parts[0] : null),
      followers: a?.followers ?? null,
      joined: a?.joined ? Date.parse(a.joined) || null : null,
      at: p?.tweet?.created_timestamp ? p.tweet.created_timestamp * 1000 : null,
      text: p?.tweet?.text?.slice(0, 280) ?? null,
      verified: !!a?.verification?.verified,
      post: id,
      likes: p?.tweet?.likes ?? null,
      reposts: p?.tweet?.retweets ?? null,
      replies: p?.tweet?.replies ?? null,
      views: p?.tweet?.views ?? null,
    };
  }
  const handle = parts[0] && /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) ? parts[0] : null;
  if (!handle) return o;
  const p = await json<{ followers_count?: number; created_at?: string; screen_name?: string }>(`https://api.vxtwitter.com/${handle}`, 2500);
  return {
    ...o,
    kind: "account",
    handle: p?.screen_name ?? handle,
    followers: p?.followers_count ?? null,
    joined: p?.created_at ? Date.parse(p.created_at) || null : null,
  };
}

/** the coin's X origin: from the cache, or worked out now (waiting at most waitMs; the next read gets the rest) */
export async function originOf(mint: string, uri: string | null, socials: { type?: string; url?: string }[], websites: { url?: string }[], waitMs = 1500): Promise<Origin | null> {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.t < 600_000) return hit.v;
  let p = pending.get(mint);
  if (!p) {
    p = build(uri, socials, websites).then((v) => {
      if (cache.size > 2000) cache.clear();
      cache.set(mint, { t: Date.now(), v });
      pending.delete(mint);
      return v;
    });
    pending.set(mint, p);
  }
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
}

/** the X post and account a coin's metadata links, without asking X (for its namesakes) */
export async function linkOf(uri: string): Promise<{ handle: string | null; post: string | null }> {
  const meta = await json<Meta>(uri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/"), 1500);
  const tw = clean(meta?.twitter);
  if (!tw) return { handle: null, post: null };
  try {
    const u = new URL(tw);
    if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return { handle: null, post: null };
    const parts = u.pathname.split("/").filter(Boolean);
    const st = parts.indexOf("status");
    const post = st > 0 && /^\d+$/.test(parts[st + 1] ?? "") ? parts[st + 1] : null;
    const handle = parts[0] && parts[0] !== "i" && /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) ? parts[0] : null;
    return { handle, post };
  } catch {
    return { handle: null, post: null };
  }
}

/** a post's likes and reposts now, from the public mirror (for how fast it is spreading) */
export async function postNow(handle: string | null, post: string): Promise<{ likes: number; reposts: number; views: number | null } | null> {
  const p = await json<{ tweet?: { likes?: number; retweets?: number; views?: number | null } }>(`https://api.fxtwitter.com/${handle ?? "i"}/status/${post}`, 2000);
  return p?.tweet ? { likes: p.tweet.likes ?? 0, reposts: p.tweet.retweets ?? 0, views: p.tweet.views ?? null } : null;
}
