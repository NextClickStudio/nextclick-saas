"use client";

import Link from "next/link";
import { age, usd } from "@/lib/format";
import { verdict } from "@/lib/oracle";
import type { HotCoin } from "@/lib/types";
import { Bar, CoinImg, Ring } from "./Bits";

export const MIN_N = 25; // look-alike pool needed before odds are shown

const TONE_COLOR = { up: "#22e39a", mid: "#ffb547", down: "#ff4d6d", rug: "#ff4d6d" } as const;

export function OracleCard({ c, now, sol, i }: { c: HotCoin; now: number; sol: number; i: number }) {
  const [mint, name, symbol, uri, t0, mc, , n2, b2, , o] = c;
  const ready = o && !o.old && o.n >= MIN_N && o.odds?.k;
  const v = ready ? verdict(o.odds, o.base, false) : null;
  const tone = v?.tone ?? "learn";
  return (
    <Link href={`/c/${mint}`} className={`ocard glass t-${tone}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
      <div className="ocard-head">
        <CoinImg uri={uri} symbol={symbol} size={44} />
        <div className="ocard-name">
          <b>{symbol ? `$${symbol.replace(/^\$/, "")}` : "Unnamed"}</b>
          <span>
            {name ?? mint.slice(0, 8)} · {age(now - t0)} old
          </span>
        </div>
        <div className="ocard-mc">
          <b className="mono">{mc ? usd(mc * sol) : "–"}</b>
          <span>market cap</span>
        </div>
      </div>
      {v && ready ? (
        <div className="ocard-odds">
          <Ring value={v.score / 100} color={TONE_COLOR[v.tone]} label="score" size={70} />
          <div className="bars">
            <Bar label="Pump 50%" value={o.odds.p50} color="#22e39a" title="Look-alikes that went up 50% in the next 10 minutes" />
            <Bar label="Doubles" value={o.odds.p2x} color="#ffd36b" title="Look-alikes that doubled in the next 10 minutes" />
            <Bar label="Dump 50%" value={o.odds.dump} color="#ff4d6d" title="Look-alikes that fell 50% in the next 10 minutes" />
          </div>
        </div>
      ) : (
        <div className="ocard-odds" style={{ gridTemplateColumns: "1fr" }}>
          <p className="small dim" style={{ margin: 0, lineHeight: 1.5 }}>
            {o?.old
              ? "Older than 40 minutes. The oracle reads coins in their first 40 minutes, where the action is."
              : `Learning: ${o && !o.old ? o.n : 0} coins seen at this age so far. Odds appear at ${MIN_N}.`}
          </p>
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

export default function HotBoard({ coins, now, sol }: { coins: HotCoin[] | null; now: number; sol: number }) {
  if (!coins)
    return (
      <div className="board">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skel" />
        ))}
      </div>
    );
  if (!coins.length) return <div className="board-empty glass">The oracle is waking up. New coins show up here within a minute.</div>;
  return (
    <div className="board">
      {coins.map((c, i) => (
        <OracleCard key={c[0]} c={c} now={now} sol={sol} i={i} />
      ))}
    </div>
  );
}
