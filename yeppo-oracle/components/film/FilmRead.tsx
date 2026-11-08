"use client";

// Film 01 · Read a coin. A trading page opens on a coin; the pointer clicks the yeppo icon; the side panel slides in
// and reads the coin check by check; the verdict rises; the pointer opens the holders. 14 seconds.
import { at, io, k, mix, out, type Film } from "./engine";
import { Browser, Chart, Cursor, Mark, Rise, Tick, candles } from "./parts";

const DATA = candles(46, 11);
const ROWS: [string, string][] = [
  ["Launch bundle", "3.1% · 4 wallets"],
  ["Insiders", "11.2% on real balances"],
  ["Top 10 holders", "18.6%"],
  ["Creator", "2nd coin · no rugs"],
  ["Money behind", "paid by an exchange"],
  ["Same-amount buys", "none"],
  ["Mint · freeze", "revoked"],
  ["Liquidity", "on the curve"],
];
const WIN = { x: 70, y: 56, w: 1140, h: 688 };
const PANEL_W = 392;

function Scene({ t }: { t: number }) {
  const open = k(t, 3.3, 4.2); // the panel slides in
  const chartW = mix(WIN.w - 48, WIN.w - 48 - PANEL_W - 12, io(k(t, 3.3, 4.3, (x) => x)));
  // the pointer: from the chart to the icon, a click, then into the panel and down to the holders
  const p1 = io(k(t, 1.9, 3.05, (x) => x));
  const p2 = io(k(t, 9.6, 10.9, (x) => x));
  const icon = { x: WIN.x + WIN.w - 40, y: WIN.y + 14 };
  const holders = { x: WIN.x + WIN.w - PANEL_W + 150, y: WIN.y + 44 + 188 };
  const cx = t < 9.6 ? mix(380, icon.x, p1) : mix(icon.x, holders.x, p2);
  const cy = t < 9.6 ? mix(600, icon.y, p1) : mix(icon.y, holders.y, p2);
  const scan = k(t, 4.3, 7.6, (x) => x);
  return (
    <div className="fm">
      <Browser x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} url="your trading site  ·  $SEAL / SOL" t={t} iconLit={k(t, 3.1, 3.7)}>
        <div style={at(24, 22)}>
          <div className="fm-coin">
            <b>$SEAL</b>
            <span>Seal of approval</span>
            <em>$48.2K</em>
          </div>
          <div style={{ marginTop: 18 }}>
            <Chart w={chartW} h={470} data={DATA} shown={mix(0, DATA.length, k(t, 0.4, 2.4, io))} />
          </div>
          <div className="fm-tape" style={{ width: chartW }}>
            {["buy 0.42", "buy 1.10", "sell 0.30", "buy 0.18", "buy 2.05", "sell 0.66", "buy 0.24"].map((x, i) => (
              <span key={i} style={{ opacity: k(t, 0.8 + i * 0.18, 1.1 + i * 0.18) }}>
                {x}
              </span>
            ))}
          </div>
        </div>
        {/* the yeppo panel */}
        <div className="fm-panel" style={at(WIN.w - PANEL_W, 0, { width: PANEL_W, height: WIN.h - 44, transform: `translateX(${mix(PANEL_W + 20, 0, open)}px)` })}>
          <div className="fm-p-head">
            <Mark size={18} />
            <b>yeppo</b>
            <span>pump.fun · 9 min</span>
          </div>
          <div className="fm-p-scan">
            <span>{scan < 1 ? "Reading the chain" : "Read in 1.1 s"}</span>
            <i style={{ transform: `scaleX(${scan})` }} />
          </div>
          <div className="fm-p-rows">
            {ROWS.map(([a, b], i) => {
              const s = 4.5 + i * 0.36;
              const v = k(t, s, s + 0.5);
              return (
                <div key={a} className="fm-p-row" style={{ opacity: mix(0.12, 1, v), transform: `translateX(${mix(14, 0, v)}px)` }}>
                  <Tick p={k(t, s + 0.15, s + 0.55)} />
                  <span>{a}</span>
                  <em>{v > 0.3 ? b : "·····"}</em>
                </div>
              );
            })}
          </div>
          <div className="fm-p-verdict">
            <Rise p={k(t, 8.0, 8.8)} className="fm-p-word">
              Safe
              <i className="fm-dot" />
            </Rise>
            <Rise p={k(t, 8.4, 9.2)} className="fm-p-why">
              Nothing wrong found · 24 / 24 checks clean
            </Rise>
          </div>
          <div className="fm-p-holders" style={{ opacity: k(t, 10.9, 11.4), transform: `translateY(${mix(10, 0, k(t, 10.9, 11.5))}px)` }}>
            {[
              ["7xKp…3f", "4.0%", "exchange-funded"],
              ["9mQw…aa", "3.1%", "holding"],
              ["DfW1…Ys", "2.2%", "bought in block 1"],
            ].map(([w, p, n]) => (
              <div key={w}>
                <span>{w}</span>
                <b>{p}</b>
                <em>{n}</em>
              </div>
            ))}
          </div>
        </div>
      </Browser>
      <Cursor x={cx} y={cy} t={t} clickAt={[3.15, 10.95]} />
    </div>
  );
}

export const filmRead: Film = {
  id: "read",
  title: "Read a coin",
  line: "Open a coin, click the icon: the panel reads it from the chain in about a second and gives one word.",
  duration: 14,
  chapters: [
    { at: 0, label: "Open a coin" },
    { at: 3.1, label: "Click yeppo" },
    { at: 4.3, label: "24 checks" },
    { at: 8, label: "One word" },
    { at: 10.6, label: "Who holds it" },
  ],
  caption: (t) => (t < 3.2 ? "Open any coin on Axiom, GMGN or pump.fun." : t < 4.4 ? "Click the yeppo icon." : t < 8 ? "It reads the coin from the chain." : t < 10.6 ? "One word." : t < 13 ? "And who holds it, wallet by wallet." : ""),
  Scene,
};
