"use client";

// Hot on X: the posts that matter right now in the viewer's own J7 feed, picked by yeppo (accounts that move coins:
// big or known accounts, posts handing out a coin; the last 30 minutes), each with the coins launched AFTER it from
// its words, first born first, and the fresh coins it hands out: the early entries a post creates, not old coins
// that share a word. Newest post first. The feed stays in the browser; yeppo is asked only which coins carry the words.
import { useEffect, useMemo, useState } from "react";
import type { HotCoin } from "@/app/api/hot/route";
import { ago } from "@/lib/format";
import { j7Token, setJ7Token, type J7Status, useJ7 } from "@/lib/j7";
import { savedKey } from "@/lib/pay";
import { goodPost, postWeight, type Signal } from "@/lib/radar";
import { readLocal } from "@/lib/supabase";

const STOPISH = /^(this|that|with|from|have|will|just|what|when|they|about|more|over|into|been|than|them|your|after|says|said|today|breaking|update|report|people|world|first|news|price|market|crypto|bitcoin|trump|elon)$/;

/** the words a coin could be named after in a post: its cashtags first, then its uncommon single words */
function wordsOf(s: Signal): string[] {
  const out: string[] = [];
  for (const m of s.text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,15})/g)) out.push(m[1].toLowerCase());
  for (const w of s.text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/))
    if (w.length >= 4 && w.length <= 12 && !/^\d+$/.test(w) && !STOPISH.test(w)) out.push(w);
  return [...new Set(out)].slice(0, 3);
}

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);

export function HotList({ signals, status, idq, now }: { signals: Signal[]; status: J7Status; idq: string; now: number }) {
  // the posts worth it: last 30 minutes, accounts that move coins or posts handing one out
  const posts = useMemo(() => signals.filter((s) => now - s.at < 30 * 60_000 && goodPost(s)).sort((a, b) => postWeight(b) - postWeight(a)).slice(0, 8), [signals, now]);
  // each word with the time of its post (the earliest, when several posts share it), and the coins handed out
  const ask = useMemo(() => {
    const since = new Map<string, number>();
    for (const s of posts) for (const w of wordsOf(s)) since.set(w, Math.min(since.get(w) ?? s.at, s.at));
    const w = [...since].slice(0, 20).map(([x, t]) => `${x}:${t}`).join(",");
    const cas = [...new Set(posts.flatMap((s) => s.cas))].slice(0, 20).join(",");
    return w || cas ? `w=${encodeURIComponent(w)}&cas=${encodeURIComponent(cas)}` : "";
  }, [posts]);
  const [coins, setCoins] = useState<HotCoin[]>([]);
  const [sol, setSol] = useState(0);
  useEffect(() => {
    if (!ask || !idq) return;
    let alive = true;
    const get = () =>
      fetch(`/api/hot?${ask}&${idq}`, { signal: AbortSignal.timeout(8000) })
        .then((r) => r.json())
        .then((j: { coins?: HotCoin[]; sol?: number }) => {
          if (!alive) return;
          setCoins(j.coins ?? []);
          if (j.sol) setSol(j.sol);
        })
        .catch(() => undefined);
    void get();
    // fresh coins appear every few seconds after a post: asked again every 10 s
    const t = setInterval(get, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ask, idq]);

  if (status === "off" || status === "denied")
    return <p className="cp-j7">Connect J7 (button at the bottom) to see the posts that matter right now and the coins born from them.</p>;
  if (!posts.length) return <p className="cp-j7">{status === "live" ? "No post from a big or known account in your J7 feed in the last 30 minutes." : "Reading your J7 feed…"}</p>;

  // each post with its coins: launched after it from its words (2 minutes of slack for clocks), or handed out in it
  // and under an hour older than it; first born first
  const rows = posts.map((s) => {
    const ws = new Set(wordsOf(s));
    const cas = new Set(s.cas);
    const seen = new Set<string>();
    const list = coins
      .filter((c) => !c[7] && ((ws.has(c[0]) && c[3] >= s.at - 120_000) || (c[0] === "" && cas.has(c[1]) && c[3] >= s.at - 3_600_000)))
      .sort((a, b) => a[3] - b[3])
      .filter((c) => (seen.has(c[1]) ? false : (seen.add(c[1]), true)))
      .slice(0, 4)
      .map((c) => ({ mint: c[1], sym: c[2], mc: c[4], hix: c[5], t: c[3] }));
    return { s, list };
  });
  rows.sort((a, b) => Number(b.list.length > 0) - Number(a.list.length > 0) || b.s.at - a.s.at);

  return (
    <div className="hot">
      {rows.map(({ s, list }) => (
        <div key={s.id} className="hot-post">
          <a className="hot-head" href={s.url ?? undefined} target="_blank" rel="noreferrer">
            <b>@{s.author}</b>
            {s.verified ? " ✓" : ""} · {k(s.followers)} · {ago(now - s.at)}
          </a>
          <p className="hot-text">{s.text}</p>
          {list.length ? (
            <div className="hot-coins">
              {list.map((c) => (
                <a key={c.mint} href={`https://yeppo.it/go/${c.mint}`} target="_blank" rel="noreferrer" className={c.hix >= 2 ? "up" : ""}>
                  {c.sym ? `$${c.sym.replace(/^\$/, "")}` : "Coin"}
                  {sol ? ` ${usd(c.mc * sol)}` : ""}
                  {c.hix >= 1.5 ? ` ×${c.hix.toFixed(1)}` : ""}
                  <span className="hot-age"> {ago(now - c.t)}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="hot-none">No new coin from this post yet</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** the panel with no coin open: Hot on X on its own, with the J7 token the extension hands over */
export default function HotOnX({ pkey: pk, pdev: pd }: { pkey: string | null; pdev: string | null }) {
  // the Pro key and device id: from the extension, else from this browser (where yeppo.it keeps them), as the coin panel does
  const [id, setId] = useState<{ key: string | null; dev: string | null }>({ key: pk, dev: pd });
  // (the device id the coin panel keeps in this browser; no import of the panel, which imports this file)
  useEffect(() => setId({ key: pk ?? savedKey(), dev: pd ?? readLocal<string | null>("yo:dev", null) }), [pk, pd]);
  const pkey = id.key;
  const pdev = id.dev;
  const [token, setToken] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setToken(j7Token());
    const on = (e: MessageEvent) => {
      if (!(e.origin.startsWith("chrome-extension://") && e.source === window.parent)) return;
      const d = e.data as { yeppo?: string; token?: unknown } | null;
      if (d?.yeppo !== "j7") return;
      const t = typeof d.token === "string" && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(d.token) ? d.token : null;
      setJ7Token(t);
      setToken(t);
    };
    window.addEventListener("message", on);
    const parent = window.location.ancestorOrigins?.[0] ?? "";
    if (parent.startsWith("chrome-extension://") && window.parent !== window) window.parent.postMessage({ yeppo: "j7?" }, parent);
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      window.removeEventListener("message", on);
      clearInterval(t);
    };
  }, []);
  const { status, signals } = useJ7(pkey ? token : null);
  const idq = pkey ? `key=${pkey}${pdev ? `&dev=${pdev}` : ""}` : "";
  return (
    <section className="cp-row cp-hotbox">
      <header>
        <h3>Hot on X</h3>
        <span className="grow" />
        <span className="cp-sum">from your J7 feed</span>
      </header>
      {pkey ? <HotList signals={signals} status={status} idq={idq} now={now} /> : <p className="cp-j7">Needs a Pro key.</p>}
    </section>
  );
}
