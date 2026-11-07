"use client";

// Wallet radar: the viewer's own wallets (pasted from Axiom's export as is) and the wallets yeppo proved on its own,
// and what they are buying right now. An early call is 2+ of the viewer's wallets in the same coin within 15 minutes,
// none of them out, and yeppo's full read saying Safe. Below: each of the viewer's wallets with the record yeppo
// measured, and the wallets yeppo found, ready to copy back into Axiom.
import { useEffect, useMemo, useState } from "react";
import type { Book, BookWallet, Radar as RadarData, RadarCoin } from "@/app/api/radar/route";
import { ago } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { savedKey } from "@/lib/pay";
import { deviceId } from "./CoinPanel";

const usd = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** what the viewer pasted: Axiom's export JSON, any JSON list, or addresses separated by spaces, commas or lines */
function parseList(text: string): unknown[] {
  const t = text.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : [j];
  } catch {
    return [...new Set(t.split(/[\s,;]+/).filter((w) => MINT_RE.test(w)))];
  }
}

/** the same shape Axiom imports, so the list goes back in with one paste */
function axiomExport(ws: BookWallet[], prefix: string) {
  return JSON.stringify(
    ws.map((w, i) => ({
      trackedWalletAddress: w.who,
      name: w.name ?? `${prefix} ${i + 1}`,
      emoji: w.emoji ?? "👻",
      alertsOnToast: true,
      alertsOnBubble: true,
      alertsOnFeed: true,
      groups: ["Main"],
      sound: "default",
      highlightColor: null,
    })),
    null,
    2,
  );
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          },
          () => window.prompt("Copy this", text),
        );
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function CoinRow({ c, sol, now, compact }: { c: RadarCoin; sol: number; now: number; compact?: boolean }) {
  const call = c.signal && c.verdict?.word === "Safe" && c.pass === true;
  const since = c.mc_in && c.mc_in > 0 ? c.mc / c.mc_in - 1 : null;
  const tone = c.verdict?.word === "Safe" ? "up" : c.verdict?.word === "Danger" ? "down" : c.verdict?.word === "Risky" ? "mid" : "";
  const href = compact ? `https://yeppo.it/go/${c.mint}` : `/c/${c.mint}`;
  return (
    <a className={`rd-coin ${call ? "call" : ""} ${c.out > 0 ? "exit" : ""}`} href={href} target={compact ? "_blank" : undefined} rel="noreferrer">
      <div className="rd-top">
        <b>{c.sym ? `$${c.sym.replace(/^\$/, "")}` : short(c.mint)}</b>
        {c.t0 ? <span className="rd-dim">{ago(now - c.t0)}</span> : null}
        <span className="grow" />
        {sol && c.mc ? <span className="rd-mc">{usd(c.mc * sol)}</span> : null}
        {since != null ? <span className={`rd-since ${since >= 0 ? "up" : "down"}`}>{since >= 0 ? "+" : ""}{Math.round(since * 100)}%</span> : null}
      </div>
      <div className="rd-who">
        {c.wallets.slice(0, 6).map((w) => (
          <span key={w.who} className={`rd-w ${w.own ? "own" : ""} ${w.out >= w.in * 0.5 && w.out > 0 ? "sold" : ""}`} title={w.who}>
            {w.emoji ?? (w.own ? "●" : "◆")} {w.label}
          </span>
        ))}
        {c.wallets.length > 6 ? <span className="rd-dim">+{c.wallets.length - 6}</span> : null}
      </div>
      <div className="rd-line">
        {call ? (
          <span className="rd-tag up">Early call · every check passes</span>
        ) : c.out > 0 ? (
          <span className="rd-tag mid">A lead wallet is out</span>
        ) : c.verdict ? (
          <span className={`rd-tag ${tone}`}>{c.verdict.word}</span>
        ) : (
          <span className="rd-dim">
            {c.own ? `${c.own} of yours` : ""}
            {c.own && c.proven ? " · " : ""}
            {c.proven ? `${c.proven} proven by yeppo` : ""}
          </span>
        )}
        {c.flags.rug && <span className="rd-tag down">Rugged</span>}
        {c.flags.bundle >= 0.15 && <span className="rd-tag down">Bundle {Math.round(c.flags.bundle * 100)}%</span>}
        {c.flags.dev_cex && <span className="rd-dim">creator funded by an exchange</span>}
      </div>
      {c.checklist && (
        <div className="rd-checks">
          {c.checklist.map((l) => (
            <span key={l.label} className={l.ok ? "ok" : "no"} title={l.why}>
              {l.ok ? "✓" : "✕"} {l.label}
              <em> · {l.why}</em>
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

export default function Radar({ pkey, pdev, compact }: { pkey: string | null; pdev: string | null; compact?: boolean }) {
  // the Pro key and device id: from the extension, else from this browser (a new device id is made if none yet)
  const [id, setId] = useState<{ key: string | null; dev: string | null }>({ key: pkey, dev: pdev });
  useEffect(() => setId({ key: pkey ?? savedKey(), dev: pdev ?? deviceId() }), [pkey, pdev]);
  const idq = id.key ? `key=${id.key}${id.dev ? `&dev=${id.dev}` : ""}` : "";
  const [tab, setTab] = useState<"live" | "mine" | "found">("live");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const live = usePoll<RadarData>(
    idq
      ? async () => {
          const r = await fetch(`/api/radar?${idq}`, { signal: AbortSignal.timeout(15_000) });
          const j = (await r.json()) as RadarData & { error?: string; why?: string; locked?: boolean };
          if (!r.ok || j.error || j.locked) throw new Error(j.why ?? j.error ?? "yeppo is busy");
          return j;
        }
      : null,
    5_000,
    idq || "-",
  );
  const book = usePoll<Book>(
    idq && tab !== "live"
      ? async () => {
          const r = await fetch(`/api/radar?${idq}&book=1`, { signal: AbortSignal.timeout(15_000) });
          const j = (await r.json()) as Book & { error?: string; why?: string };
          if (!r.ok || j.error) throw new Error(j.why ?? j.error ?? "yeppo is busy");
          return j;
        }
      : null,
    60_000,
    `${idq}|${tab}`,
  );

  async function save() {
    const list = parseList(paste);
    if (!list.length) return setNote("No wallet addresses found in what you pasted.");
    setNote("Saving…");
    try {
      const r = await fetch("/api/radar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: id.key, dev: id.dev, list }) });
      const j = (await r.json()) as { saved?: number; error?: string; why?: string };
      if (!r.ok || j.error) throw new Error(j.why ?? j.error ?? "Could not save");
      setNote(`${j.saved ?? 0} wallets saved. Their buys show up here within 5 seconds, each with yeppo's full read.`);
      setPaste("");
      live.reload();
      book.reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save");
    }
  }

  const coins = useMemo(() => live.data?.coins ?? [], [live.data]);
  const tracked = live.data?.tracked ?? 0;

  if (!id.key)
    return (
      <section className="cp-row rd">
        <header>
          <h3>Wallet radar</h3>
        </header>
        <p className="cp-j7">Needs a Pro key.</p>
      </section>
    );

  return (
    <section className="cp-row rd">
      <header>
        <h3>Wallet radar</h3>
        <span className="grow" />
        <span className="cp-sum">{tracked ? `${tracked} wallets · ${live.data?.proven ?? 0} proven by yeppo` : "add your wallets"}</span>
      </header>
      <div className="rd-tabs" role="tablist">
        {(["live", "mine", "found"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "live" ? "Live" : t === "mine" ? "Your wallets" : "Found by yeppo"}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <>
          {!live.data && !live.error && <div className="skel" style={{ height: 90 }} />}
          {live.error && !live.data && <p className="cp-j7">{live.error}</p>}
          {live.data && !coins.length && (
            <p className="cp-j7">
              {tracked
                ? "None of your wallets bought a pump.fun coin in the last 15 minutes. yeppo checks every 5 seconds."
                : "Paste your wallets below to see what they buy. Meanwhile yeppo shows the coins its proven wallets are buying."}
            </p>
          )}
          <div className="rd-list">
            {coins.map((c) => (
              <CoinRow key={c.mint} c={c} sol={live.data?.sol ?? 0} now={now} compact={compact} />
            ))}
          </div>
          <p className="rd-rule">
            Early call only when every line passes: 2+ of your wallets in within 15 minutes and none selling, creator funded by an exchange or a whale, mint and freeze revoked, top 10 under 30%, at least $25K, and yeppo reads it Safe.
            Your plan: at most 8% of your wallet, stop at −6%, out when the lead wallet is out. yeppo never trades for you.
          </p>
        </>
      )}

      {tab === "mine" && (
        <>
          {book.data?.mine.length ? (
            <>
              <div className="rd-book">
                {book.data.mine.map((w) => (
                  <div key={w.who} className="rd-bw" title={w.who}>
                    <span>
                      {w.emoji ?? "●"} {w.name ?? short(w.who)}
                    </span>
                    <span className="rd-dim">
                      {w.tries ? `${w.wins}/${w.tries} early entries doubled` : "no early entry seen yet"}
                      {w.flips && w.tries && w.flips * 3 > w.tries ? " · sells in seconds, hard to copy" : ""}
                    </span>
                    {w.proven ? <span className="rd-tag up">proven</span> : null}
                  </div>
                ))}
              </div>
              <Copy text={axiomExport(book.data.mine, "wallet")} label="Copy for Axiom" />
            </>
          ) : (
            !book.error && <p className="cp-j7">{book.data ? "No wallets yet: paste your list below." : "Loading…"}</p>
          )}
        </>
      )}

      {tab === "found" && (
        <>
          {book.data?.found.length ? (
            <>
              <p className="rd-dim" style={{ margin: "0 0 8px" }}>
                Wallets that keep getting into coins in the first minutes before they double, from different creators, and that hold past the first minute.
              </p>
              <div className="rd-book">
                {book.data.found.slice(0, 50).map((w) => (
                  <div key={w.who} className="rd-bw" title={w.who}>
                    <span>{short(w.who)}</span>
                    <span className="rd-dim">
                      {w.wins}/{w.tries} doubled · {Math.round((w.hit ?? 0) * 100)}% · {w.creators} creators
                    </span>
                  </div>
                ))}
              </div>
              <Copy text={axiomExport(book.data.found.slice(0, 100), "yeppo")} label="Copy top 100 for Axiom" />
            </>
          ) : (
            !book.error && <p className="cp-j7">{book.data ? "yeppo is still learning: check back in a few hours." : "Loading…"}</p>
          )}
        </>
      )}

      <details className="rd-import" open={!tracked}>
        <summary>{tracked ? "Replace your wallet list" : "Add your wallets"}</summary>
        <label htmlFor="rd-paste" className="rd-dim">
          Paste the list Axiom exports (Wallet tracker, Export), or addresses one per line. Up to 500.
        </label>
        <textarea id="rd-paste" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='[{"trackedWalletAddress": "…", "name": "…", "emoji": "👻"}]' />
        <div className="rd-row">
          <button type="button" className="btn btn-sm btn-go" onClick={() => void save()} disabled={!paste.trim()}>
            Save wallets
          </button>
          {note && <span className="rd-dim">{note}</span>}
        </div>
      </details>
    </section>
  );
}
