"use client";

// The owner's private lab: a paper wallet to test yeppo with pretend SOL at real pump.fun prices. Not linked
// anywhere; it only opens with the lab key.
import { useEffect, useState } from "react";
import { age, isMint, mult, short } from "@/lib/format";
import { useNow, usePoll } from "@/lib/hooks";
import { paperBuy, paperSell, paperState, type PaperState } from "@/lib/paper";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import Nav from "./Nav";

const pct = (x: number | null | undefined) => (x == null ? "–" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`);

export default function Lab() {
  const [key, setKey] = useState<string | null>(null);
  const [acct, setAcct] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setKey(readLocal<string | null>("yo:lab", null));
    setAcct(readLocal<string | null>("yo:paper", null));
  }, []);
  const { data: st, error } = usePoll<PaperState>(acct ? () => paperState(acct) : null, 4000, acct ?? "");
  const now = useNow(1000);
  // the extension listens on this page: one click hands it the lab key and the paper wallet
  const [ext, setExt] = useState<"none" | "here" | "linked">("none");
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.yeppo === "ext") setExt((x) => (x === "linked" ? x : "here"));
      if (e.data?.yeppo === "linked") setExt("linked");
    };
    window.addEventListener("message", on);
    window.postMessage({ yeppo: "ping" }, location.origin);
    return () => window.removeEventListener("message", on);
  }, []);

  if (!key)
    return (
      <>
        <Nav />
        <main className="page wrap lab">
          <div className="page-head">
            <h1>Lab</h1>
            <p>Private. Paste the lab key.</p>
          </div>
          <form
            className="lab-form"
            onSubmit={(e) => {
              e.preventDefault();
              writeLocal("yo:lab", input.trim());
              setKey(input.trim());
            }}
          >
            <div className="field">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Lab key" spellCheck={false} />
              <button className="btn btn-go btn-sm">Open</button>
            </div>
          </form>
        </main>
      </>
    );

  return (
    <>
      <Nav />
      <main className="page wrap lab">
        <div className="page-head">
          <h1>Paper wallet</h1>
          <p>Pretend SOL at real pump.fun prices, fees in (1.75% a side). Only you see this page.</p>
        </div>
        {!acct ? (
          <button
            className="btn btn-go"
            onClick={async () => {
              try {
                const id = await rpc<string>("yr_paper_new", { p_key: key, p_name: "owner" });
                writeLocal("yo:paper", id);
                setAcct(id);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            Start with 10 paper SOL
          </button>
        ) : error && !st ? (
          <p className="down">{error}</p>
        ) : !st ? (
          <div className="skel" style={{ height: 80 }} />
        ) : (
          <>
            <div className="lab-nums">
              <div>
                <span>equity</span>
                <b className="mono">{st.equity.toFixed(3)} SOL</b>
              </div>
              <div>
                <span>result</span>
                <b className={`mono ${st.equity >= st.start ? "up" : "down"}`}>{pct(st.equity / st.start - 1)}</b>
              </div>
              <div>
                <span>cash</span>
                <b className="mono">{st.sol.toFixed(3)} SOL</b>
              </div>
              <div>
                <span>closed trades</span>
                <b className="mono">
                  {st.stats.trades} · {st.stats.trades ? Math.round((st.stats.wins / st.stats.trades) * 100) : 0}% won
                </b>
              </div>
            </div>
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              {ext === "linked" ? (
                <p className="up small" style={{ margin: 0 }}>
                  Linked ✓ Open any coin: the panel shows a Paper trade box.
                </p>
              ) : ext === "here" ? (
                <button className="btn btn-go btn-sm" onClick={() => window.postMessage({ yeppo: "link", lab: key, paper: acct }, location.origin)}>
                  Use this wallet in the extension
                </button>
              ) : (
                <p className="small mute" style={{ margin: 0 }}>
                  Install the extension and refresh this page to link it in one click.
                </p>
              )}
            </div>
            <Buy acct={acct} onErr={setErr} />
            <h3>Open</h3>
            {st.positions.length ? (
              <div className="lab-rows">
                {st.positions.map((p) => {
                  const r = p[3] > 0 ? p[6] / p[3] - 1 : 0;
                  return (
                    <div key={p[0]} className="lab-row">
                      <a href={`/c/${p[0]}`} className="mono">
                        {p[1] ? `$${p[1]}` : short(p[0])}
                      </a>
                      <span className="mono">{p[3].toFixed(2)} SOL</span>
                      <b className={`mono ${r >= 0 ? "up" : "down"}`}>{mult(1 + r)}</b>
                      <span className="pp-row">
                        {[0.5, 1].map((f) => (
                          <button key={f} className="btn btn-sm" onClick={() => void paperSell(acct, p[0], f).catch((e) => setErr(e.message))}>
                            Sell {f * 100}%
                          </button>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mute small">No open position.</p>
            )}
            <h3>History</h3>
            <div className="lab-rows">
              {st.fills.map((f, i) => (
                <div key={i} className="lab-row">
                  <span className="mono">{f[1] ? `$${f[1]}` : short(f[0])}</span>
                  <span className={f[2] === 1 ? "" : "mute"}>{f[2] === 1 ? "buy" : `sell · ${f[6]}`}</span>
                  <b className={`mono ${f[5] == null ? "" : f[5] >= 0 ? "up" : "down"}`}>
                    {f[5] == null ? `${f[3].toFixed(3)} SOL` : `${f[5] >= 0 ? "+" : ""}${f[5].toFixed(3)}`}
                  </b>
                  <span className="dim small">{age(now - f[7])} ago</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (confirm("Reset the paper wallet to 10 SOL?")) void rpc("yr_paper_reset", { p_acct: acct });
              }}
            >
              Reset to 10 SOL
            </button>
          </>
        )}
        {err && <p className="down small">{err}</p>}
      </main>
    </>
  );
}

function Buy({ acct, onErr }: { acct: string; onErr: (e: string | null) => void }) {
  const [mint, setMint] = useState("");
  const [sol, setSol] = useState("0.1");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="lab-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const m = mint.trim();
        if (!isMint(m)) return onErr("Paste a coin address");
        setBusy(true);
        onErr(null);
        try {
          await paperBuy(acct, m, Number(sol), null);
          setMint("");
        } catch (er) {
          onErr(er instanceof Error ? er.message : "Something went wrong");
        }
        setBusy(false);
      }}
    >
      <div className="field">
        <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Coin address" spellCheck={false} />
        <input value={sol} onChange={(e) => setSol(e.target.value)} inputMode="decimal" style={{ width: 56, flex: "none" }} aria-label="SOL" />
        <button className="btn btn-go btn-sm" disabled={busy}>
          Paper buy
        </button>
      </div>
    </form>
  );
}
