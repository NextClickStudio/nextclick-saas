"use client";

// This coin's first 20 minutes drawn over the same minutes of its creator's earlier coins, prices as multiples
// of the launch price on a log scale. Where the old lines fall off a cliff is where this creator dumps.
import type { PastCoin } from "@/lib/decide";
import { mins } from "@/lib/decide";

const W = 400;
const H = 170;
const PAD = { l: 26, r: 8, t: 10, b: 18 };
const T = 1200; // 20 minutes

export default function Overlay({ me, ghosts, sellS, sellX }: { me: [number, number][]; ghosts: PastCoin[]; sellS: number | null; sellX: number | null }) {
  const lines = ghosts.filter((g) => g.path?.length).slice(0, 8);
  const all = [...me.map((p) => p[1]), ...lines.flatMap((g) => g.path!)].filter((v) => v > 0);
  if (!all.length) return <div className="ov-none">No chart yet. It draws from the first trades.</div>;
  const lo = Math.log(Math.min(0.7, ...all));
  const hi = Math.log(Math.max(2.2, ...all) * 1.08);
  const X = (s: number) => PAD.l + (Math.min(T, Math.max(0, s)) / T) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (Math.log(Math.max(v, 1e-3)) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const d = (pts: [number, number][]) => pts.map(([s, v], i) => `${i ? "L" : "M"}${X(s).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
  const ticks = [1, 2, 5, 10, 25].filter((v) => Math.log(v) > lo && Math.log(v) < hi);
  const last = me[me.length - 1];
  return (
    <div className="ov">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="This coin against its creator's earlier coins">
        <defs>
          <linearGradient id="ovg" x1="0" x2="1">
            <stop offset="0" stopColor="#7d8bff" />
            <stop offset="1" stopColor="#c9b8ff" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line className="ov-axis" x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} />
            <text x={2} y={Y(v) + 3} fontSize="9" fill="#5f5f74" fontFamily="var(--mono)">
              ×{v}
            </text>
          </g>
        ))}
        {[0, 5, 10, 15, 20].map((m) => (
          <text key={m} x={X(m * 60)} y={H - 4} fontSize="9" fill="#5f5f74" textAnchor="middle" fontFamily="var(--mono)">
            {m}m
          </text>
        ))}
        {lines.map((g, i) => (
          <path
            key={g.mint}
            className={`ov-ghost ov-draw ${g.fate}`}
            pathLength={1}
            style={{ animationDelay: `${200 + i * 140}ms` }}
            d={d(g.path!.map((v, k) => [(k + 1) * 30, v] as [number, number]))}
          />
        ))}
        {sellS != null && sellS < T && (
          <g>
            <line className="ov-sell" x1={X(sellS)} x2={X(sellS)} y1={PAD.t} y2={H - PAD.b} />
            <text className="ov-tag" x={Math.min(X(sellS) + 4, W - 92)} y={PAD.t + 9}>
              creator sells {sellX ? `~×${sellX.toFixed(1)}` : ""} · {mins(sellS)}
            </text>
          </g>
        )}
        {me.length > 1 && <path className="ov-me ov-draw" pathLength={1} d={d(me)} />}
        {last && (
          <circle className="ov-dot" cx={X(last[0])} cy={Y(last[1])} r="3.2">
            <animate attributeName="r" values="3.2;5;3.2" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <div className="ov-legend">
        <span>
          <i style={{ background: "linear-gradient(90deg,#7d8bff,#c9b8ff)" }} />
          this coin
        </span>
        {lines.length > 0 && (
          <span>
            <i style={{ background: "#ff5fd2", opacity: 0.6 }} />
            creator&apos;s last {lines.length}
          </span>
        )}
      </div>
    </div>
  );
}
