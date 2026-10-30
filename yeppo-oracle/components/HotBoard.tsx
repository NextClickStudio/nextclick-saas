"use client";

import Link from "next/link";
import { age, usd } from "@/lib/format";
import { flags, MIN_N, TONE_COLOR, verdict, type Flag, type Verdict } from "@/lib/oracle";
import type { HotCoin, Track } from "@/lib/types";
import { Bar, CoinImg, Ring } from "./Bits";

type Read = { c: HotCoin; v: Verdict | null; fl: Flag[] };

function read(c: HotCoin, track: Track | null): Read {
  const o = c[10];
  const sig = { ladder: !!c[11]?.ladder, devSold: false, dev: c[12] ?? null };
  const ready = !!o && !o.old && o.n >= MIN_N && o.odds?.k > 0;
  return { c, v: ready && o && !o.old ? verdict(o.odds, o.base, sig, track) : null, fl: flags(sig) };
}

function OracleCard({ r, now, sol, i }: { r: Read; now: number; sol: number; i: number }) {
  const { c, v, fl } = r;
  const [mint, name, symbol, uri, t0, mc, , n2, b2, , o] = c;
  const tone = v?.tone ?? "learn";
  return (
    <Link href={`/c/${mint}`} className={`ocard glass t-${tone}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
      <div className="ocard-head">
        <CoinImg uri={uri} symbol={symbol} size={44} />
        <div className="ocard-name">
          <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : "Unnamed"}</b>
          <span>
            {name ?? mint.slice(0, 8)} · {age(now - t0)}
          </span>
        </div>
        <div className="ocard-mc">
          <b className="mono">{mc ? usd(mc * sol) : "–"}</b>
          <span>mcap</span>
        </div>
      </div>
      {v && o && !o.old ? (
        <div className="ocard-odds">
          <Ring value={v.score / 100} color={TONE_COLOR[v.tone]} label="score" size={64} />
          <div className="bars">
            <Bar label="Pump 50%" value={o.odds.p50} color="#22e39a" title="Look-alikes that went up 50% in the next 10 minutes" />
            <Bar label="Dump 50%" value={o.odds.dump} color="#ff4d6d" title="Look-alikes that fell 50% in the next 10 minutes" />
          </div>
        </div>
      ) : (
        <p className="ocard-note small dim">
          {o?.old ? "Older than 40 minutes: out of the oracle's range." : `Learning: ${o && !o.old ? o.n : 0} coins seen at this age.`}
        </p>
      )}
      {fl.length > 0 && (
        <div className="ocard-flags">
          {fl.slice(0, 2).map((f) => (
            <span key={f.text} className={`flag-chip f-${f.tone}`} title={f.text}>
              {f.icon} {f.text.split(":")[0].split(".")[0]}
            </span>
          ))}
        </div>
      )}
      <div className="ocard-foot">
        <span className={`verdict-chip t-${tone}`}>{v ? v.label : o?.old ? "Too old" : "Learning"}</span>
        <span className="mono">
          {n2} trades · {n2 ? Math.round((b2 / n2) * 100) : 0}% buys
        </span>
      </div>
    </Link>
  );
}

function Grid({ rs, now, sol }: { rs: Read[]; now: number; sol: number }) {
  return (
    <div className="board">
      {rs.map((r, i) => (
        <OracleCard key={r.c[0]} r={r} now={now} sol={sol} i={i} />
      ))}
    </div>
  );
}

/** the hot coins sorted by what the oracle thinks of them: clean setups first, dangers apart, dying coins left out */
export default function HotBoard({ coins, now, sol, track }: { coins: HotCoin[] | null; now: number; sol: number; track: Track | null }) {
  if (!coins)
    return (
      <div className="board">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skel" />
        ))}
      </div>
    );
  if (!coins.length) return <div className="board-empty glass">The oracle is waking up. New coins show up here within a minute.</div>;
  const rs = coins.map((c) => read(c, track));
  const picks = rs.filter((r) => r.v?.tone === "up").sort((a, b) => (b.c[10] && !b.c[10].old ? b.c[10].odds.p50 : 0) - (a.c[10] && !a.c[10].old ? a.c[10].odds.p50 : 0));
  const flips = rs.filter((r) => r.v?.tone === "mid" || !r.v);
  const avoid = rs.filter((r) => r.v?.tone === "down" || r.v?.tone === "rug");
  const fading = rs.filter((r) => r.v?.tone === "flat").length;
  return (
    <div className="board-sections">
      <div>
        <div className="sub-title">
          <h3 className="disp">🔥 Runner potential</h3>
          <span className="small dim">Most look-alikes pumped, few dumped, no red flags</span>
        </div>
        {picks.length ? (
          <Grid rs={picks} now={now} sol={sol} />
        ) : (
          <p className="board-empty glass small">No clean setup right now. yeppo would rather show nothing than guess.</p>
        )}
      </div>
      {avoid.length > 0 && (
        <div>
          <div className="sub-title">
            <h3 className="disp">☠️ Avoid</h3>
            <span className="small dim">Likely dumps, bot ladders and serial ruggers</span>
          </div>
          <Grid rs={avoid} now={now} sol={sol} />
        </div>
      )}
      {flips.length > 0 && (
        <div>
          <div className="sub-title">
            <h3 className="disp">🎲 Coin flips</h3>
            <span className="small dim">No edge either way{fading ? ` · ${fading} more coins are fading out` : ""}</span>
          </div>
          <Grid rs={flips} now={now} sol={sol} />
        </div>
      )}
    </div>
  );
}
