import type { Metadata } from "next";
import Nav, { Footer } from "@/components/Nav";
import Reveal from "@/components/Reveal";
import { DB_HEADERS } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Record · yeppo",
  description: "Every call yeppo showed on a pump.fun coin, and what the coin did next. Updated every hour, nothing left out.",
};
export const revalidate = 600;

/** [day, word, calls, made ×2 after, made ×3 after, fell 50% after] (yr_record, worked out every hour) */
type Row = [string, string, number, number, number, number];

async function rows(): Promise<Row[] | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_record_s`, { method: "POST", headers: DB_HEADERS, body: "{}", next: { revalidate: 600 } });
    return r.ok ? ((await r.json()) as Row[]) : null;
  } catch {
    return null;
  }
}

/** [mint, ticker, call, × after the call, called at] (yr_wins_s) */
type Win = [string, string | null, string, number, number];
async function wins(): Promise<Win[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_wins_s`, { method: "POST", headers: DB_HEADERS, body: "{}", next: { revalidate: 600 } });
    return r.ok ? ((await r.json()) as Win[]) : [];
  } catch {
    return [];
  }
}

const WORDS = [
  { w: "Momentum", t: "up" },
  { w: "Opportunity", t: "up" },
  { w: "Wait", t: "mid" },
  { w: "Don't buy", t: "down" },
];
const ODDS = ["Odds 0-5%", "Odds 5-10%", "Odds 10-20%", "Odds 20%+"];
const pc = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default async function Page() {
  const [all, won] = await Promise.all([rows(), wins()]);
  const days = 7;
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const sum = (word: string) =>
    (all ?? [])
      .filter((r) => r[1] === word && r[0] >= since)
      .reduce((a, r) => [a[0] + r[2], a[1] + r[3], a[2] + r[4], a[3] + r[5]], [0, 0, 0, 0]);
  const total = WORDS.reduce((a, w) => a + sum(w.w)[0], 0);
  return (
    <>
      <Nav />
      <main className="page wrap">
        <Reveal className="page-head">
          <span className="kicker">
            <i className="live" /> Updated every hour
          </span>
          <h1>
            yeppo&apos;s <span className="grad">record.</span>
          </h1>
          <p>Every call yeppo showed on a pump.fun coin in the last {days} days, and what the coin did next. Nothing left out.</p>
        </Reveal>

        {all == null ? (
          <p className="mute">The record isn&apos;t answering right now. Try again in a minute.</p>
        ) : total === 0 ? (
          <p className="mute">Collecting the first calls: the numbers show up here within a few hours.</p>
        ) : (
          <>
            {(() => {
              const buys = ["Momentum", "Opportunity"].map(sum).reduce((a, r) => [a[0] + r[0], a[1] + r[1]], [0, 0]);
              const dodged = sum("Don't buy");
              const best = won[0];
              return (
                <div className="rec-hero">
                  <Reveal className="card rec-stat t-up">
                    <span className="rec-cap">Best call this week</span>
                    <div className="rec-big mono up">{best ? `×${best[3] >= 10 ? Math.round(best[3]) : best[3].toFixed(1)}` : "–"}</div>
                    <span className="rec-cap">{best ? `$${(best[1] ?? "?").replace(/^\$/, "")} after ${best[2]}` : "the first wins show up here"}</span>
                  </Reveal>
                  <Reveal className="card rec-stat t-down" delay={70}>
                    <span className="rec-cap">Rugs dodged</span>
                    <div className="rec-big mono">{dodged[3].toLocaleString("en-US")}</div>
                    <span className="rec-cap">
                      coins yeppo said Don&apos;t buy that then fell 50% or more ({pc(dodged[3], dodged[0])} of them)
                    </span>
                  </Reveal>
                  <Reveal className="card rec-stat t-up" delay={140}>
                    <span className="rec-cap">Buy calls that went ×2</span>
                    <div className="rec-big mono">{pc(buys[1], buys[0])}</div>
                    <span className="rec-cap">
                      {buys[1]} of {buys[0]} Momentum and Opportunity calls doubled after the call
                    </span>
                  </Reveal>
                </div>
              );
            })()}

            {won.length > 0 && (
              <Reveal className="card rec-odds">
                <h2>Real wins</h2>
                <p className="mute">Coins yeppo called Momentum or Opportunity this week that then went ×2 or more, from the price at the call.</p>
                <div className="rec-wins">
                  {won.map(([mint, sym, word, up, t]) => (
                    <a key={mint + word} href={`/go/${mint}`} target="_blank" rel="noreferrer" className="rec-win">
                      <b>${(sym ?? "?").replace(/^\$/, "")}</b>
                      <span className="dim">{word}</span>
                      <b className="mono up">×{up >= 10 ? Math.round(up) : up.toFixed(1)}</b>
                      <span className="dim mono">{new Date(t).toISOString().slice(5, 16).replace("T", " ")} UTC</span>
                    </a>
                  ))}
                </div>
              </Reveal>
            )}

            <div className="rec-grid">
              {WORDS.map(({ w, t }, i) => {
                const [n, x2, x3, down] = sum(w);
                return (
                  <Reveal key={w} className={`card rec t-${t}`} delay={i * 70}>
                    <b className="rec-word">
                      <i />
                      {w}
                    </b>
                    <div className="rec-big mono">{pc(x2, n)}</div>
                    <span className="rec-cap">went ×2 after the call</span>
                    <div className="rec-small">
                      <span>
                        <b className="mono">{pc(x3, n)}</b> ×3
                      </span>
                      {/* only a Don't buy is judged on the fall after it (the rug it kept you out of); a buy call is
                          judged on the ×2 / ×3 from the call: what a coin does after you took profit doesn't count */}
                      {w === "Don't buy" && (
                        <span>
                          <b className="mono">{pc(down, n)}</b> fell 50% (rugs dodged)
                        </span>
                      )}
                      <span>
                        <b className="mono">{n.toLocaleString("en-US")}</b> calls
                      </span>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="card rec-odds">
              <h2>Are the odds right?</h2>
              <p className="mute">yeppo shows how often coins like the one you&apos;re on went ×2. Here is how often they really did.</p>
              <div className="rec-table">
                <span className="dim">yeppo said</span>
                <span className="dim">really went ×2</span>
                <span className="dim">coins</span>
                {ODDS.map((o) => {
                  const [n, x2] = sum(o);
                  return [
                    <b key={`${o}a`}>{o.replace("Odds ", "")}</b>,
                    <b key={`${o}b`} className="mono">
                      {pc(x2, n)}
                    </b>,
                    <span key={`${o}c`} className="mono mute">
                      {n.toLocaleString("en-US")}
                    </span>,
                  ];
                })}
              </div>
            </Reveal>
          </>
        )}
        <p className="dim small" style={{ marginTop: 18 }}>
          A call counts from the moment yeppo showed it, on coins in their first 2 hours on pump.fun. ×2 means the price
          doubled from there at any point after. Rugs dodged: Don&apos;t buy calls on coins that then lost half from there. Past results don&apos;t promise future ones.
        </p>
      </main>
      <Footer />
    </>
  );
}
