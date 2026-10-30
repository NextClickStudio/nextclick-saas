"use client";

// The owner's private lab: a paper wallet to test everything with pretend SOL at real prices, and the live
// scoreboard of yeppo's own paper bots. Not linked anywhere; it only opens with the lab key.
import { useEffect, useState } from "react";
import { age, isMint, mult, short } from "@/lib/format";
import { usePoll, useNow } from "@/lib/hooks";
import { paperBuy, paperSell, paperState, type BotRow, type PaperState } from "@/lib/paper";
import { readLocal, rpc, writeLocal } from "@/lib/supabase";
import TopBar from "./TopBar";

const BOT_INFO: Record<string, string> = {
  "bot:yeppo": "buys every Runner call whose Exit Plan worked on the look-alikes, and follows the plan",
  "bot:random": "the control: at the same moment buys a random other coin of the board, same plan levels",
  "bot:avoid": "buys what yeppo says to avoid (Likely dump, Rug risk), with its plan levels",
  "bot:all": "buys every coin of the board that gets a verdict: what an average coin does",
  "bot:scout": "runs the expert checks (holders, dev, snipers, activity) on the board, buys only when yeppo also says Runner",
  "bot:expert": "the expert checks alone, without asking yeppo: what the checklist is worth by itself",
  "bot:safe": "safety checks pass and yeppo does not flag it: measures how often a coin yeppo clears is not a scam",
};
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
  const { data: board } = usePoll<BotRow[] | null>(key ? () => rpc<BotRow[] | null>("yr_paper_board", { p_key: key }) : null, 15_000, key ?? "");
  const { data: st, error } = usePoll<PaperState>(acct ? () => paperState(acct) : null, 4000, acct ?? "");
  const now = useNow(1000);

  if (!key)
    return (
      <>
        <TopBar />
        <main className="page wrap lab">
          <div className="page-head">
            <h1 className="disp">Lab</h1>
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
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Lab key" spellCheck={false} />
            <button className="btn btn-glow btn-sm">Open</button>
          </form>
        </main>
      </>
    );

  return (
    <>
      <TopBar />
      <main className="page wrap lab">
        <div className="page-head">
          <h1 className="disp">Lab</h1>
          <p>Paper trading with pretend SOL at real curve prices, fees in (1.75% a side). Only you see this page.</p>
        </div>

        <section className="lab-sec">
          <h2 className="disp">yeppo&apos;s bots, live</h2>
          <p className="dim">Every 30 s they read the board exactly like the extension does and paper-trade 0.1 SOL, once per coin.</p>
          {board === null || board === undefined ? (
            <p className="dim">{board === null ? "Wrong lab key." : "Loading…"}</p>
          ) : (
            <div className="lab-bots">
              {board.map((b) => (
                <div key={b.bot} className={`lab-bot ${b.bot === "bot:yeppo" || b.bot === "bot:scout" ? "main" : ""}`}>
                  <header>
                    <b className="mono">{b.bot}</b>
                    <span className="dim">{b.open} open</span>
                  </header>
                  <p className="dim small">{BOT_INFO[b.bot]}</p>
                  <div className="lab-nums">
                    <div>
                      <span>closed</span>
                      <b className="mono">{b.trades}</b>
                    </div>
                    <div>
                      <span>won</span>
                      <b className="mono">{b.trades ? `${Math.round((b.wins / b.trades) * 100)}%` : "–"}</b>
                    </div>
                    <div>
                      <span>avg trade</span>
                      <b className={`mono ${(b.avg ?? 0) >= 0 ? "up" : "down"}`}>{pct(b.avg)}</b>
                    </div>
                    <div>
                      <span>total</span>
                      <b className={`mono ${b.pnl >= 0 ? "up" : "down"}`}>
                        {b.pnl >= 0 ? "+" : ""}
                        {b.pnl.toFixed(3)} SOL
                      </b>
                    </div>
                  </div>
                  <p className="tiny dim">
                    exits: {b.tp} take profit · {b.stop} stop · {b.time} time · median {pct(b.med)} · best {pct(b.best)} · worst {pct(b.worst)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lab-sec">
          <h2 className="disp">My paper wallet</h2>
          {!acct ? (
            <button
              className="btn btn-glow"
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
            <p className="dim">Loading…</p>
          ) : (
            <>
              <div className="lab-nums wide">
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
              <p className="small dim">
                Paper wallet id <span className="mono">{acct}</span> · lab key <span className="mono">{key}</span>. To paper-trade inside the
                extension, open its side panel, click &quot;lab&quot; at the bottom and paste both.
              </p>
              <Buy acct={acct} onErr={setErr} />
              <h3>Open</h3>
              {st.positions.length ? (
                <div className="lab-table">
                  {st.positions.map((p) => {
                    const r = p[3] > 0 ? p[6] / p[3] - 1 : 0;
                    return (
                      <div key={p[0]} className="lab-row">
                        <a href={`/c/${p[0]}`} target="_blank" rel="noreferrer" className="mono">
                          {p[1] ? `$${p[1]}` : short(p[0])}
                        </a>
                        <span className="mono">{p[3].toFixed(2)} SOL</span>
                        <b className={`mono ${r >= 0 ? "up" : "down"}`}>{mult(1 + r)}</b>
                        <span className="dim small">
                          {p[8] ? `TP ${mult(p[8])}` : ""} {p[9] ? `· stop ${mult(p[9])}` : ""}{" "}
                          {p[10] ? `· ${Math.max(0, Math.round((p[10] - now) / 1000))}s left` : ""}
                        </span>
                        <span className="lab-sell">
                          {[0.5, 1].map((f) => (
                            <button key={f} className="btn btn-sm btn-ghost" onClick={() => void paperSell(acct, p[0], f).catch((e) => setErr(e.message))}>
                              Sell {f * 100}%
                            </button>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="dim">No open position.</p>
              )}
              <h3>History</h3>
              <div className="lab-table">
                {st.fills.map((f, i) => (
                  <div key={i} className="lab-row hist">
                    <span className="mono">{f[1] ? `$${f[1]}` : short(f[0])}</span>
                    <span className={f[2] === 1 ? "" : "dim"}>{f[2] === 1 ? "buy" : `sell · ${f[6]}`}</span>
                    <span className="mono">{f[3].toFixed(3)} SOL</span>
                    <b className={`mono ${f[5] == null ? "" : f[5] >= 0 ? "up" : "down"}`}>{f[5] == null ? "" : `${f[5] >= 0 ? "+" : ""}${f[5].toFixed(3)}`}</b>
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
        </section>
      </main>
    </>
  );
}

function Buy({ acct, onErr }: { acct: string; onErr: (e: string | null) => void }) {
  const [mint, setMint] = useState("");
  const [sol, setSol] = useState("0.1");
  const [withPlan, setWithPlan] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="lab-buy"
      onSubmit={async (e) => {
        e.preventDefault();
        const m = mint.trim();
        if (!isMint(m)) return onErr("Paste a coin address");
        setBusy(true);
        onErr(null);
        try {
          const plan = withPlan ? ((await fetch(`/api/read?mint=${m}`).then((r) => r.json())) as { plan?: { tp: number; stop: number; minutes: number } }).plan : null;
          await paperBuy(acct, m, Number(sol), plan ?? null);
          setMint("");
        } catch (er) {
          onErr(er instanceof Error ? er.message : "Something went wrong");
        }
        setBusy(false);
      }}
    >
      <input value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Coin address" spellCheck={false} />
      <input value={sol} onChange={(e) => setSol(e.target.value)} inputMode="decimal" className="sol" />
      <label>
        <input type="checkbox" checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} /> follow the Exit Plan
      </label>
      <button className="btn btn-glow btn-sm" disabled={busy}>
        Paper buy
      </button>
    </form>
  );
}
