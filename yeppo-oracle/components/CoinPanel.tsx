"use client";

// The read of one coin: the call, the moment, the creator's history laid over this coin, and the safety
// checks. The same component fills the extension's panel and the coin page; it refreshes every 8 seconds and follows
// the coin's trades straight from the chain in between.
import { useEffect, useRef, useState } from "react";
import type { Fate, Risk } from "@/lib/decide";
import { mins } from "@/lib/decide";
import { age, ago, mult, short, usd } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { liveCall, liveDump, livePulse, liveSellers, useLiveTrades } from "@/lib/live";
import { type Money, readCoin, type Read } from "@/lib/read";
import type { Odds } from "@/lib/odds";
import { j7Token, setJ7Token, useJ7 } from "@/lib/j7";
import { type Signal, tweetFor } from "@/lib/radar";
import type { J7Status } from "@/lib/j7";
import type { TheCoin } from "@/lib/thecoin";
import type { Origin } from "@/lib/origin";
import type { XSignals } from "@/lib/xsignals";
import { HotList } from "./HotOnX";
import { KOLS } from "@/lib/kols";
import type { Kol } from "@/lib/decide";
import type { LiveTrade } from "@/lib/live";
import { license, savedKey } from "@/lib/pay";
import { readLocal, writeLocal } from "@/lib/supabase";
import { CoinImg, Num } from "./Bits";
import Overlay from "./Overlay";

const FATE: Record<Fate, string> = { rug: "Rugged", dead: "Faded", ran: "Ran", grad: "Graduated" };
const x = (v: number) => `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`;
const sign = (v: number | null) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`);

/** tell the extension this page sits in (and only the extension, never another site that frames yeppo) */
function tellExtension(msg: Record<string, unknown>) {
  const parent = window.location.ancestorOrigins?.[0] ?? (document.referrer ? new URL(document.referrer).origin : "");
  if (parent.startsWith("chrome-extension://") && window.parent !== window) window.parent.postMessage(msg, parent);
}

/** hands the extension the call as it is now (live trades included), so the toolbar button's colour changes the
 *  moment the side panel sees buyers come in */
function TellCall({ mint, word, tone, why }: { mint: string; word: string; tone: string; why: string }) {
  useEffect(() => {
    tellExtension({ yeppo: "call", mint, word, tone, why });
  }, [mint, word, tone, why]);
  return null;
}

/** this browser's random device id (a Pro key works on 3 devices) */
export function deviceId(): string {
  let d = readLocal<string | null>("yo:dev", null);
  if (!d || !/^[0-9a-f-]{36}$/.test(d)) {
    d = crypto.randomUUID();
    writeLocal("yo:dev", d);
  }
  return d;
}

/** pkey and pdev: the Pro key and the device id the extension keeps (its frame cannot read yeppo.it's storage); on
 *  yeppo.it itself they come from this browser's storage */
export default function CoinPanel({
  mint,
  compact,
  pkey,
  pdev,
}: {
  mint: string;
  compact?: boolean;
  pkey?: string | null;
  pdev?: string | null;
}) {
  const [key, setKey] = useState<string | null | undefined>(pkey ?? undefined);
  const [dev, setDev] = useState<string | null>(pdev ?? null);
  useEffect(() => {
    setKey(pkey ?? savedKey());
    setDev(pdev ?? deviceId());
  }, [pkey, pdev]);
  const fastRef = useRef(true);
  // the coin is shown only once its read is complete for real (holders, launch, creator, X), or after 10 s with what
  // is in: never a half read that looks like a whole one. Until then the panel asks every 1.5 s
  const openedAt = useRef<{ mint: string; t: number }>({ mint, t: Date.now() });
  if (openedAt.current.mint !== mint) openedAt.current = { mint, t: Date.now() };
  const shownFor = useRef<string | null>(null);
  // the poll's key must change once the Pro key is known (even when there is none), or it would never start
  const { data: r, error } = usePoll<Read>(
    key === undefined ? null : () => readCoin(mint, key, dev),
    // 1.5 s while the read is coming in, then every 3 s while the coin is on pump.fun's curve (where it moves),
    // every 10 s once it trades elsewhere
    () => (shownFor.current !== mint ? 1500 : fastRef.current ? 3000 : 10_000),
    `${mint}:${key === undefined ? "?" : (key ?? "-")}`,
  );
  const now = useNow(1000);
  fastRef.current = !r || !!r.live;
  const rd = r?.ready;
  const complete = !!r && (!!r.locked || !rd || (rd.holders && rd.creator && rd.launch && rd.x));
  if (r && (complete || now - openedAt.current.t > 10_000)) shownFor.current = mint;
  const shown = shownFor.current === mint;
  // the viewer's J7 feed (their own token, from the extension or this browser): the post behind this coin, if any
  const [j7, setJ7] = useState<string | null>(null);
  useEffect(() => {
    setJ7(j7Token());
    const on = (e: MessageEvent) => {
      if (!(e.origin.startsWith("chrome-extension://") && e.source === window.parent)) return;
      const d = e.data as { yeppo?: string; token?: unknown } | null;
      if (d?.yeppo !== "j7") return;
      // the extension's J7 switch: a token connects, none disconnects
      const t = typeof d.token === "string" && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(d.token) ? d.token : null;
      setJ7Token(t);
      setJ7(t);
    };
    window.addEventListener("message", on);
    tellExtension({ yeppo: "j7?" });
    return () => window.removeEventListener("message", on);
  }, []);
  const { status: j7s, signals } = useJ7(r && !r.locked ? j7 : null);
  // the coin's trades straight from the chain, while it trades on pump.fun's curve
  const { trades, live } = useLiveTrades(mint, !!r?.live && !r?.locked);
  const [skew, setSkew] = useState(0);
  const liveNow = r?.live?.now;
  useEffect(() => {
    if (liveNow) setSkew(liveNow - Date.now());
  }, [liveNow]);
  if (!r || !shown)
    return (
      <div className="cp">
        {error && !r ? (
          <div className="cp-empty">
            <b>Retrying…</b>
            yeppo is busy. It tries again in a few seconds.
          </div>
        ) : (
          <Loading sym={r?.symbol ?? null} ready={rd ?? null} />
        )}
      </div>
    );

  if (r.locked)
    return (
      <div className="cp">
        <section className="cp-call t-learn">
          <div className="cp-word cp-word-in">
            <i />
            Pro key needed
          </div>
          <p>{r.decision.why}</p>
        </section>
        <ProBox onKey={setKey} />
        <div className="cp-foot">
          <span>Short-term read. Not advice.</span>
          <a href="mailto:info@yeppo.it">Help: info@yeppo.it</a>
        </div>
      </div>
    );

  const lp = r.live && live ? livePulse(r.live, trades, skew) : null;
  const dump = live ? liveDump(trades) : null;
  // the server's verdict, Safe / Risky / Danger, as it is: no timing call from the live trades (4 Nov 2026)
  void dump;
  void lp;
  const d = r.decision;
  // the biggest holders selling, seen in the live trades within the second, else the server's facts
  // (no Exit alert any more: see app/api/read)
  const exit: string | null = null;
  const c = r.creator;
  const bad = r.checks.filter((k) => !k.ok).length;
  return (
    <div className="cp">
      <TellCall mint={mint} word={exit && d.word !== "Don't buy" ? "Exit" : d.word} tone={exit && d.word !== "Don't buy" ? "down" : d.tone} why={exit ?? d.why} />
      <div className="cp-head">
        <CoinImg uri={r.uri} src={r.image} symbol={r.symbol} size={36} />
        <div>
          <b>{r.symbol ? `$${r.symbol.replace(/^\$/, "")}` : short(mint)}</b>
          <span className="sub">
            {r.venue}
            {r.t0 ? ` · ${age(now - r.t0)}` : ""}
          </span>
        </div>
        <div className="cp-mc">
          <b className="mono">{usd(r.mcUsd)}</b>
          <span className="sub">{r.priceX != null ? `${x(r.priceX)} from launch` : "market cap"}</span>
        </div>
      </div>

      <section className={`cp-call t-${d.tone}`}>
        <div key={d.word} className="cp-word cp-word-in">
          <i />
          {d.word}
          {lp && (
            <span className="cp-live" title="Updated with every trade, straight from the chain">
              live
            </span>
          )}
        </div>
        <p>{d.why}</p>
        {r.launchState === "reading" && !r.launch && (
          <p className="cp-callchk">
            <i />
            Still checking the insiders · the call may change in a few seconds
          </p>
        )}
        {exit && d.word !== "Don't buy" && (
          <div className="cp-exit">
            <b>Exit</b>
            {exit}
          </div>
        )}
      </section>

      <TheCoinCard c={r.thecoin ?? null} sig={tweetFor({ mint, sym: r.symbol, name: r.name }, signals)} j7={j7s} now={now} origin={r.origin ?? null} xs={r.xs ?? null} boosts={r.boosts ?? 0} t0={r.t0} />

      {r.odds && <OddsRow o={r.odds} />}

      <Traders r={r.risk ?? null} live={live ? trades : []} t0={r.t0} />

      <Holders
        mint={mint}
        r={r.risk ?? null}
        launch={r.launch ?? null}
        eta={r.launchEta ?? null}
        state={r.launchState ?? null}
        attempt={r.launchTry ?? null}
      />

      <details className="cp-fold">
        <summary>
          <h3>Creator</h3>
          <span className={`cp-sum ${c && (c.rugs > 0 || (r.money?.rugs ?? 0) > 0) ? "down" : ""}`}>{c ? c.line : r.down?.includes("history") ? "Not answering, retrying" : "Unknown"}</span>
        </summary>
        <div className="cp-fold-in">
          {r.dev && (
            <p className="cp-line mute" style={{ fontSize: 12 }}>
              {r.dev.rugS != null
                ? `On this coin: dumped it ${sign(-(r.dev.rugDrop ?? 0.6))} after ${mins(r.dev.rugS)}.`
                : r.dev.out
                  ? `On this coin: sold everything${r.dev.soldS != null ? ` after ${mins(r.dev.soldS)}` : ""}.`
                  : r.dev.sold
                    ? `On this coin: started selling${r.dev.soldX ? ` at ${x(r.dev.soldX)}` : ""}.`
                    : r.dev.bought
                      ? "On this coin: still holding."
                      : "On this coin: didn't buy."}
            </p>
          )}
          <Overlay me={r.path} ghosts={c?.coins ?? []} sellS={c?.sellS ?? null} sellX={c?.sellX ?? null} />
          {c && c.coins.length > 0 && (
            <div className="cp-coins">
              {c.coins.map((k) => (
                <a key={k.mint} className="cp-coin" href={`/c/${k.mint}`} target={compact ? "_blank" : undefined} rel="noreferrer">
                  <span>
                    {k.sym ? `$${k.sym}` : short(k.mint)} <span className="when">{ago(now - k.t0)}</span>
                  </span>
                  <span className="mono mute">{k.peak >= 0.5 ? x(k.peak) : "–"}</span>
                  <span className="mono dim">{k.rugS != null ? `dump ${sign(-(k.rugDrop ?? 0.6))}` : k.soldS != null ? `sold ${mins(k.soldS)}` : ""}</span>
                  <span className={`chip tone fate fate-${k.fate}`}>{FATE[k.fate]}</span>
                </a>
              ))}
            </div>
          )}
          <MoneyBox mint={mint} dev={c?.dev ?? null} m={r.money} devOut={!!r.dev?.out} />
        </div>
      </details>

      <details className="cp-fold" open={bad > 0}>
        <summary>
          <h3>Safety</h3>
          <span className={`cp-sum ${bad ? "down" : r.down?.includes("rugcheck") ? "mid" : "up"}`}>
            {bad ? `${bad} problem${bad > 1 ? "s" : ""}` : r.down?.includes("rugcheck") ? "Partial" : r.checks.length ? `${r.checks.length}/${r.checks.length} safe` : "…"}
          </span>
        </summary>
        <div className="cp-fold-in">
          {r.down?.includes("rugcheck") && (
            <p className="cp-line mute" style={{ fontSize: 12, margin: "0 0 8px" }}>
              RugCheck isn&apos;t answering: these checks come straight from the chain.
            </p>
          )}
          <div className="cp-checks">
            {[...r.checks]
              .sort((a, b) => Number(a.ok) - Number(b.ok))
              .map((k, i) => (
                <div key={k.label} className={`cp-check ${k.ok ? "" : "bad"}`} style={{ "--i": i } as React.CSSProperties}>
                  <i>{k.ok ? "✓" : "✕"}</i>
                  {k.label}
                </div>
              ))}
            {r.holders != null && <div className="cp-check dim" style={{ "--i": r.checks.length } as React.CSSProperties}>{r.holders.toLocaleString("en-US")} holders</div>}
          </div>
        </div>
      </details>

      {r.deep && r.deep.lines.length > 0 && (
        <details className="cp-fold" open={r.deep.lines.some((l) => l.tone === "bad")}>
          <summary>
            <h3>Deep checks</h3>
            {(() => {
              const w = r.deep!.lines.filter((l) => l.tone === "bad" || l.tone === "warn").length;
              return <span className={`cp-sum ${r.deep!.lines.some((l) => l.tone === "bad") ? "down" : w ? "mid" : "up"}`}>{w ? `${w} to watch` : "nothing odd"}</span>;
            })()}
          </summary>
          <div className="cp-fold-in">
            <div className="cp-checks">
              {r.deep.lines.map((l, i) => (
                <div key={l.text} className={`cp-check ${l.tone === "bad" ? "bad" : l.tone === "warn" ? "warn" : l.tone === "info" ? "dim" : ""}`} style={{ "--i": i } as React.CSSProperties}>
                  <i>{l.tone === "ok" ? "✓" : l.tone === "info" ? "·" : "!"}</i>
                  {l.text}
                </div>
              ))}
            </div>
            <p className="cp-line mute" style={{ fontSize: 11.5, margin: "8px 0 0" }}>Information next to the verdict: these checks don&apos;t change it.</p>
          </div>
        </details>
      )}

      <details className="cp-fold">
        <summary>
          <h3>Hot on X</h3>
          <span className="cp-sum">posts that matter now, from your J7</span>
        </summary>
        <div className="cp-fold-in">
          <HotList signals={signals} status={j7s} idq={key ? `key=${key}${dev ? `&dev=${dev}` : ""}` : ""} now={now} />
        </div>
      </details>

      <div className="cp-foot">
        <span>Short-term read. Not advice.</span>
        {compact ? (
          <a href={`https://yeppo.it/c/${mint}`} target="_blank" rel="noreferrer">
            Open on yeppo ↗
          </a>
        ) : (
          r.url && (
            <a href={r.url} target="_blank" rel="noreferrer">
              DexScreener ↗
            </a>
          )
        )}
      </div>
    </div>
  );
}

/** is it THE coin: the post behind it (J7) and the other coins with its name, the leader first */
/** the coin's X origin in one line: the post it was born from, or its own account, or nothing */
function OriginLine({ o, t0, now }: { o: Origin; t0: number | null; now: number }) {
  const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
  const age = (ms: number) => (ms >= 365 * 86400_000 ? `${Math.floor(ms / (365 * 86400_000))}y` : ms >= 86400_000 ? `${Math.floor(ms / 86400_000)}d` : "today");
  if (o.kind === "none" || !o.url)
    return <p className="cp-j7">No X link from the creator.</p>;
  const fresh = o.joined != null && now - o.joined < 30 * 86400_000;
  return (
    <a className={`cp-tweet ${fresh && (o.followers ?? 0) < 2000 ? "warn" : ""}`} href={o.url} target="_blank" rel="noreferrer">
      <span>
        {o.kind === "post" ? "Born from a post by " : o.kind === "account" ? "Its X account " : "X community"}
        {o.handle && <b>@{o.handle}</b>}
        {o.verified ? " ✓" : ""}
        {o.followers != null && ` · ${k(o.followers)} followers`}
        {o.joined != null && ` · account ${age(now - o.joined)} old`}
        {o.kind === "post" && o.at != null && t0 != null && ` · posted ${o.at <= t0 ? `${ago(t0 - o.at)} before launch` : "after launch"}`}
      </span>
    </a>
  );
}

/** what X says beyond the link: one short line each, only when there is something */
function XLines({ xs }: { xs: XSignals }) {
  const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
  const lines: { t: string; tone: string }[] = [];
  if (xs.author) {
    const a = xs.author;
    if (a.coins === 0) lines.push({ t: `First coin yeppo has seen born from @${a.handle}'s posts`, tone: "" });
    else {
      const rate = a.x2 / a.coins;
      const best = a.best && a.best[1] >= 2 ? `, best ${a.best[0] ? `$${a.best[0]}` : "one"} ×${a.best[1]}` : "";
      lines.push({
        t: `@${a.handle}'s posts started ${a.coins} coin${a.coins > 1 ? "s" : ""}: ${a.x2} went ×2${a.x5 ? ` (${a.x5} ×5)` : ""}, ${a.dead} died fast${best}`,
        tone: a.coins >= 3 && rate >= 0.3 ? "up" : a.coins >= 3 && a.dead / a.coins >= 0.7 ? "down" : "mid",
      });
    }
  }
  // only how fast it spreads: its plain like count is on every trading site
  if (xs.spread && xs.spread.mins >= 1) {
    const fast = xs.spread.likesMin >= 20 || xs.spread.repostsMin >= 5;
    lines.push({
      t: xs.spread.mins >= 1
        ? `Post spreading: +${k(xs.spread.likesMin)} likes and +${k(xs.spread.repostsMin)} reposts a minute (${k(xs.spread.likes)} likes now)`
        : `Post: ${k(xs.spread.likes)} likes, ${k(xs.spread.reposts)} reposts`,
      tone: fast ? "up" : "",
    });
  }
  if (xs.post) lines.push({ t: xs.post.rank === 1 ? `This post started ${xs.post.coins} coins: this one came first` : `This post started ${xs.post.coins} coins: this one is #${xs.post.rank}`, tone: xs.post.rank === 1 ? "up" : "mid" });
  if (xs.account) {
    const syms = xs.account.last.map(([s]) => (s ? `$${s}` : null)).filter(Boolean).slice(0, 3).join(", ");
    lines.push({
      t: `Same X account on ${xs.account.coins} other coin${xs.account.coins > 1 ? "s" : ""}${xs.account.bad ? `, ${xs.account.bad} crashed` : ""}${syms ? ` (${syms})` : ""}`,
      tone: xs.account.bad >= 1 && xs.account.bad >= xs.account.coins * 0.5 ? "down" : "mid",
    });
  }
  if (!lines.length) return null;
  return (
    <div className="cp-x">
      {lines.map((l) => (
        <p key={l.t} className={l.tone}>
          {l.t}
        </p>
      ))}
    </div>
  );
}

function TheCoinCard({ c, sig, j7, now, origin, xs, boosts, t0 }: { c: TheCoin | null; sig: Signal | null; j7: J7Status; now: number; origin: Origin | null; xs: XSignals | null; boosts: number; t0: number | null }) {
  const label = !c ? (sig || origin?.kind === "post" ? "Posted" : "Unique name") : c.meBest && c.meOrig ? "THE coin" : c.meBest ? "Leader" : c.meOrig ? "Original" : "Copy";
  const tone = c?.tone ?? (sig ? "up" : "mid");
  const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
  return (
    <section className={`cp-row cp-the t-${tone}`}>
      <header>
        <h3>The coin</h3>
        <span className="grow" />
        <span className={`cp-sum ${tone}`}>{label}</span>
      </header>
      {origin && <OriginLine o={origin} t0={t0} now={now} />}
      {xs && <XLines xs={xs} />}
      {origin && (origin.website || origin.telegram || boosts > 0) && (
        <p className="cp-links">
          {origin.website && (
            <a href={origin.website} target="_blank" rel="noreferrer">
              Website
            </a>
          )}
          {origin.telegram && (
            <a href={origin.telegram} target="_blank" rel="noreferrer">
              Telegram
            </a>
          )}
          {boosts > 0 && <span className="boost">Paid DexScreener boost</span>}
        </p>
      )}
      {!sig && (
        <p className="cp-j7">
          {j7 === "off" || j7 === "denied" ? (
            <>
              Connect J7 to see the post behind a coin.{" "}
              <button type="button" onClick={() => tellExtension({ yeppo: "j7-auto" })}>
                Connect J7
              </button>
            </>
          ) : j7 === "live" ? (
            "No post in your J7 feed names this coin."
          ) : (
            "Reading your J7 feed…"
          )}
        </p>
      )}
      {sig && (
        <a className="cp-tweet" href={sig.url ?? undefined} target="_blank" rel="noreferrer">
          <span>
            <b>@{sig.author}</b> · {k(sig.followers)} followers · {ago(now - sig.at)}
          </span>
          <p>{sig.text}</p>
        </a>
      )}
      {c && <p className="cp-line">{c.verdict}</p>}
      {c?.best && !c.meBest && (
        <a className="btn btn-sm btn-go cp-open" href={`https://yeppo.it/go/${c.best.mint}`} target="_blank" rel="noreferrer">
          Open the leading {c.best.orig ? "original" : "coin"} ↗
        </a>
      )}
      {c && (
        <div className="cp-names">
          {c.list.map((n) => (
            <a
              key={n.mint}
              className={`cp-name ${n.me ? "me" : ""} ${n.mint === c.best?.mint ? "lead" : ""}`}
              href={n.me ? undefined : `https://yeppo.it/go/${n.mint}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="nm">
                ${(n.sym ?? "?").replace(/^\$/, "")}
                {n.orig && <i>orig</i>}
                {n.me && <i>you</i>}
              </span>
              <span className="mono">{usd(n.mcUsd)}</span>
              <span className="mono dim">×{n.hix >= 10 ? n.hix.toFixed(0) : n.hix.toFixed(1)}</span>
              <span className={`st ${n.flag ? "down" : n.dead ? "dim" : n.live ? "up" : "dim"}`}>{n.flag ? n.flag : n.dead ? "dead" : n.live ? "live" : "quiet"}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

/** how often coins like this one made ×2 and ×3 from this point: two numbers, and how many coins they come from */
function OddsRow({ o }: { o: Odds }) {
  const pc = (v: number) => `${v >= 0.1 ? Math.round(v * 100) : (v * 100).toFixed(1)}%`;
  const tone = o.p2 >= 0.15 ? "up" : o.p2 >= 0.07 ? "mid" : "low";
  return (
    <section className={`cp-row cp-odds o-${tone}`}>
      <header>
        <h3>Coins like this</h3>
        <span className="grow" />
        <span className="cp-sum">
          {o.pk != null && o.p2 >= 0.05 ? `peak ~${Math.max(1, Math.round(o.pk / 60))} min · ` : ""}
          {o.n.toLocaleString("en-US")} coins
        </span>
      </header>
      <div className="cp-odds-g">
        <div>
          <b className="mono">{pc(o.p2)}</b>
          <span>went ×2</span>
        </div>
        <div>
          <b className="mono">{pc(o.p3)}</b>
          <span>went ×3</span>
        </div>
        <i className="cp-odds-bar" style={{ "--w": `${Math.min(100, (o.p2 / 0.3) * 100)}%` } as React.CSSProperties} />
      </div>
    </section>
  );
}

/** the top traders on the coin, one line each: who, how much, when, and whether they are still in */
/** the server's top traders, with what the live trades showed since: a top trader buying or selling shows within the
 *  second, before the next read */
function withLive(server: Kol[], trades: LiveTrade[], t0: number | null): Kol[] {
  const live = new Map<string, { sol: number; bought: number; sold: number; t: number }>();
  for (const x of trades) {
    const n = KOLS.get(x.who);
    if (!n) continue;
    const e = live.get(n) ?? { sol: 0, bought: 0, sold: 0, t: x.t };
    if (x.buy) (e.sol += x.sol), (e.bought += x.tok);
    else e.sold += x.tok;
    live.set(n, e);
  }
  if (!live.size) return server;
  const out = server.map((k) => {
    const e = live.get(k.n);
    if (!e) return k;
    live.delete(k.n);
    return e.sold > 0 && e.sold >= e.bought ? { ...k, left: Math.min(k.left, e.bought > 0 ? Math.max(0, 1 - e.sold / e.bought) : 0) } : { ...k, sol: k.sol + e.sol };
  });
  for (const [n, e] of live)
    if (e.bought > 0) out.push({ n, sol: +e.sol.toFixed(2), left: Math.max(0, 1 - e.sold / e.bought), s: t0 ? Math.max(0, Math.round((e.t - t0) / 1000)) : null });
  return out;
}

function Traders({ r, live, t0 }: { r: Risk | null; live: LiveTrade[]; t0: number | null }) {
  const ks = withLive(r?.kols ?? [], live, t0);
  const inNow = ks.filter((k) => k.left > 0.2).length;
  return (
    <section className="cp-row">
      <header>
        <h3>Top traders</h3>
        <span className="grow" />
        <span className={`cp-sum ${ks.length ? (inNow ? "up" : "down") : ""}`}>
          {ks.length ? `${inNow} in · ${ks.length - inNow} out` : "None"}
        </span>
      </header>
      {ks.length > 0 ? (
        <div className="cp-kols">
          {ks.slice(0, 5).map((k, i) => (
            <div key={i} className={`cp-kol ${k.left > 0.2 ? "in" : "out"}`}>
              <i />
              <b>{k.n || "Proven wallet"}</b>
              <span className="mono">{k.sol.toFixed(k.sol >= 10 ? 0 : 1)} SOL</span>
              <span className="mono dim">{k.s != null ? `+${mins(k.s)}` : ""}</span>
              <span className="mono">{k.left > 0.2 ? (k.left >= 0.95 ? "holding" : `holds ${Math.round(k.left * 100)}%`) : "sold"}</span>
            </div>
          ))}
          {ks.length > 5 && <p className="cp-more">+{ks.length - 5} more</p>}
        </div>
      ) : (
        <p className="cp-line mute">{r?.full ? "None of the 80 best traders or yeppo's proven wallets bought it." : "None in the last 20 minutes."}</p>
      )}
    </section>
  );
}

/** the read on its way: each part ticked off as it really comes in, the call only after */
function Loading({ sym, ready }: { sym: string | null; ready: { holders: boolean; creator: boolean; launch: boolean; x: boolean } | null }) {
  const steps: [string, boolean][] = [
    ["Holders, on real balances", !!ready?.holders],
    ["Launch bundle, from the chain", !!ready?.launch],
    ["Creator: past coins and money", !!ready?.creator],
    ["Where it was born on X", !!ready?.x],
  ];
  const done = steps.filter((x) => x[1]).length;
  return (
    <section className="cp-load">
      <b>Reading {sym ? `$${sym.replace(/^\$/, "")}` : "this coin"}…</b>
      <div className="cp-load-bar">
        <i style={{ width: `${8 + (done / steps.length) * 92}%` }} />
      </div>
      <ul>
        {steps.map(([label, ok]) => (
          <li key={label} className={ok ? "ok" : ""}>
            <span>{ok ? "✓" : ""}</span>
            {label}
          </li>
        ))}
      </ul>
      <p>yeppo shows the call only once the coin is read for real.</p>
    </section>
  );
}

/** who holds the supply, in one bar: the creator, the launch bundle nobody saw buy, the snipers of the first 15 s,
 *  and everyone else. Shares of the whole supply; what is still on pump.fun's curve stays empty. */
function Holders({
  mint,
  r,
  launch,
  eta,
  state: stateNow,
  attempt,
}: {
  mint: string;
  r: Risk | null;
  launch: { wallets: number; took: number; now: number | null } | null;
  eta: number | null;
  state: "in" | "reading" | "unavailable" | null;
  attempt: number | null;
}) {
  // once a coin's launch is in, it stays in for this coin: later polls only refresh the numbers
  const inFor = useRef<string | null>(null);
  if (stateNow === "in") inFor.current = mint;
  const state = inFor.current === mint ? "in" : stateNow;
  // the countdown only goes down: set once per attempt from the server's estimate, a second at a time after that;
  // later polls can bring it closer, never push it back. A new attempt (or a new coin) starts it again
  const [left, setLeft] = useState<number | null>(null);
  const run = useRef<string>("");
  useEffect(() => {
    if (state !== "reading" || eta == null) {
      if (state !== "reading") setLeft(null);
      return;
    }
    const id = `${mint}:${attempt ?? 0}`;
    if (run.current !== id) {
      run.current = id;
      setLeft(eta);
    } else setLeft((v) => (v == null ? eta : Math.min(v, eta)));
  }, [mint, state, eta, attempt, r]);
  useEffect(() => {
    if (state !== "reading") return;
    const t = setInterval(() => setLeft((v) => (v == null ? v : Math.max(0, v - 1))), 1000);
    return () => clearInterval(t);
  }, [state]);
  // the moment the launch comes in after a countdown: said out loud for a few seconds
  const was = useRef(state);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (state === "in" && was.current === "reading") {
      setArrived(true);
      const t = setTimeout(() => setArrived(false), 6000);
      was.current = state;
      return () => clearTimeout(t);
    }
    was.current = state;
  }, [state]);
  const reading = state === "reading" && !launch;
  const exact = state === "in" || !!launch;
  if (!r || r.out == null) return null;
  const devS = Math.max(0, r.dev ?? 0);
  const bund = Math.max(0, r.bun ?? 0, r.full ? (r.hidden ?? 0) : 0);
  const snip = r.full ? Math.max(0, r.sniperHeld) : 0;
  const bigW = Math.max(0, r.big ?? 0);
  const rest = Math.max(0, r.out - devS - bund - snip - bigW);
  const seg = [
    { k: "Creator", v: devS, c: "var(--dev)" },
    { k: "Bundle", v: bund, c: "var(--down)" },
    { k: "Snipers", v: snip, c: "var(--mid)" },
    { k: "Big wallets", v: bigW, c: "#5b6cff" },
    { k: "Everyone else", v: rest, c: "var(--up)" },
  ];
  const ins = devS + bund + snip + bigW;
  const pc = (v: number) => `${v > 0 && v < 0.01 ? "<1" : Math.round(v * 100)}%`;
  return (
    <section className="cp-row">
      <header>
        <h3>Who holds it</h3>
        <span className="grow" />
        <span className={`cp-sum ${ins >= 0.35 ? "down" : ins >= 0.2 ? "mid" : "up"}`}>
          Insiders {pc(ins)}
          {ins < 0.2 && !reading && state !== "unavailable" ? " · safe zone" : ""}
          {ins < 0.2 && state === "unavailable" ? " · unverified" : ""}
        </span>
        {reading && <span className="cp-chk">⏳ Checking</span>}
        {exact && <span className="cp-chk ok">✓ Verified</span>}
      </header>
      <div className={`cp-bar ${reading ? "cp-bar-chk" : ""}`}>
        {seg.map((g) => g.v > 0 && <i key={g.k} style={{ width: `${g.v * 100}%`, background: g.c }} title={`${g.k} ${pc(g.v)}`} />)}
      </div>
      <div className="cp-legend">
        {seg.map((g) => (
          <span key={g.k}>
            <i style={{ background: g.c }} />
            {g.k} <b className="mono">{pc(g.v)}</b>
          </span>
        ))}
      </div>
      {arrived && (
        <p className="cp-launch cp-done">
          <i />
          Launch read from the chain · the insiders above are exact
        </p>
      )}
      {launch && launch.wallets > 0 && (
        <p className="cp-launch">
          ✓ Launch bundle: {launch.wallets} wallet{launch.wallets > 1 ? "s" : ""} took <b className="mono">{pc(launch.took)}</b> in the first 2 blocks
          {launch.now != null ? (
            <>
              {" "}
              · hold <b className={`mono ${launch.now >= 0.2 ? "down" : "up"}`}>{pc(launch.now)}</b> now
            </>
          ) : null}
        </p>
      )}
      {launch && launch.wallets === 0 && <p className="cp-launch">✓ No launch bundle: nobody else bought in the first 2 blocks.</p>}
      {reading && (
        <p className="cp-launch cp-wait">
          <i />
          {left != null && left > 0 ? (
            <>
              Reading the launch from the chain · exact insiders in <b className="mono">{left}s</b>
            </>
          ) : (
            "Reading the launch from the chain · almost there…"
          )}
          {attempt != null && attempt > 1 ? <span className="dim"> · attempt {attempt}/3</span> : null}
        </p>
      )}
      {state === "unavailable" && !launch && (
        <p className="cp-launch cp-miss">
          <i />
          The chain didn&apos;t answer for this launch right now · insiders from the holders only, yeppo keeps trying
        </p>
      )}
    </section>
  );
}

/** where the creator's SOL came from, and what the same money did before. Information only: the call never
 *  depends on it. yeppo.it's server has yr-fund trace the wallet the first time; the result shows on a later refresh. */
function MoneyBox({ dev, m, devOut }: { mint: string; dev: string | null; m: Money | null; devOut: boolean }) {
  if (!dev) return null;
  let tone = "t-learn";
  let head = "Tracing…";
  const lines: string[] = [];
  if (!m || !m.checked) lines.push("Following the creator's money on-chain. A few seconds.");
  else if (m.kind === "exchange") {
    head = "Exchange";
    lines.push("The creator was funded from an exchange or a launch service used by many people. The trail stops there.");
  } else if (m.kind === "old") {
    head = "Old wallet";
    lines.push("Old wallet with a long history. Not traced.");
  } else if (m.kind !== "wallet") {
    head = "No trail";
    lines.push("No funding transfer found.");
  } else {
    const bad = m.rugs > 0 || m.dirty > 0 || m.family >= 2;
    tone = bad ? (devOut && m.dirty === 0 && m.family < 2 ? "t-mid" : "t-down") : m.coins > 0 ? "t-up" : "t-learn";
    head = bad ? "Suspicious" : m.coins > 0 ? "Clean so far" : "New money";
    if (m.rugs > 0) {
      lines.push(`The creator's SOL came from ${short(m.funder)}, a wallet tied to ${m.rugs} rug${m.rugs > 1 ? "s" : ""}${m.rug_syms.length ? ` (${m.rug_syms.map((x) => `$${x}`).join(", ")})` : ""}.`);
      lines.push(devOut ? "The creator already sold everything: they can't dump this one on you." : "The creator still holds: they could dump.");
    } else if (m.coins > 0) {
      lines.push(`Same money launched ${m.coins} other coin${m.coins > 1 ? "s" : ""}: ${m.ran} ran, ${m.coins - m.ran} faded, no rugs.${m.best && m.best >= 2 ? ` Best ×${m.best.toFixed(1)}.` : ""}`);
    } else lines.push(`Funded by ${short(m.funder)}${m.sol ? ` (${m.sol.toFixed(2)} SOL)` : ""}. No other coins from this money yet.`);
    if (m.family > 0) lines.push(`${m.family} early buyer${m.family > 1 ? "s were" : " was"} paid by the same money as the creator.`);
    if (m.dirty > 0) lines.push(`${m.dirty} early buyer${m.dirty > 1 ? "s are" : " is"} tied to past rugs.`);
  }
  return (
    <section className={`cp-box cp-money ${tone}`}>
      <header>
        <h3>Money trail</h3>
        <span className="grow" />
        <span className={`chip tone ${tone}`}>{head}</span>
      </header>
      {lines.map((l) => (
        <p key={l} className="cp-line" style={{ fontSize: 12.5, margin: "0 0 4px" }}>
          {l}
        </p>
      ))}
    </section>
  );
}

/** a free read: what Pro adds, how to get it step by step, and the place for the key */
function ProBox({ onKey }: { onKey: (k: string) => void }) {
  const [k, setK] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    const key = k.trim().toUpperCase();
    if (!key) return setErr("Paste your key first.");
    setBusy(true);
    setErr(null);
    const l = await license(key).catch(() => null);
    setBusy(false);
    if (!l?.ok) return setErr(l ? "That key is not active. Check it, or write to info@yeppo.it." : "Can't check the key right now. Try again.");
    writeLocal("yo:key", key);
    tellExtension({ yeppo: "key", key });
    onKey(key);
  };
  return (
    <section className="cp-box cp-pro">
      <header>
        <h3>Activate yeppo</h3>
        <span className="grow" />
        <span className="chip tone t-learn">Pro key</span>
      </header>
      <p className="cp-line" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
        The call on every coin, the top traders in it, the Exit alert, the safety checks and the creator&apos;s past coins. One
        key, paid in SOL.
      </p>
      <ol className="pro-steps">
        <li>
          Open{" "}
          <a href="https://yeppo.it/pricing" target="_blank" rel="noreferrer">
            yeppo.it/pricing
          </a>{" "}
          and pick a plan.
        </li>
        <li>Pay in SOL from Phantom, Solflare or Backpack: scan the QR or tap &ldquo;Open in my wallet&rdquo;.</li>
        <li>Your key shows up on the page (YEP-…). With this extension installed, yeppo turns on by itself.</li>
        <li>Didn&apos;t? Paste the key below and tap Unlock.</li>
      </ol>
      <form
        className="field"
        style={{ marginTop: 10 }}
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <input value={k} onChange={(e) => setK(e.target.value)} placeholder="YEP-XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} />
        <button className="btn btn-sm btn-go" disabled={busy}>
          {busy ? "…" : "Unlock"}
        </button>
      </form>
      {err && <p className="pp-msg down">{err}</p>}
      <a className="btn btn-sm" style={{ width: "100%", marginTop: 8, textAlign: "center" }} href="https://yeppo.it/pricing" target="_blank" rel="noreferrer">
        Get a Pro key ↗
      </a>
    </section>
  );
}
