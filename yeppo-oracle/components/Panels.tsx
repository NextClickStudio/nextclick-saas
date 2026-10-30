"use client";

import { age, mult, pct, short } from "@/lib/format";
import { exitView, isRugger, KIND, TONE_COLOR, type Check, type Decision, type Flag, type Verdict } from "@/lib/oracle";
import { inTen, type Plain } from "@/lib/plain";
import type { StoryEvent } from "@/lib/story";
import type { Base, DevHist, Kind, Odds, Xray } from "@/lib/types";
import { Num, Ring } from "./Bits";


export function VerdictBanner({ v, d, checks, k, n, ageS, fresh }: { v: Verdict; d: Decision; checks: Check[]; k: number; n: number; ageS: number; fresh: number }) {
  return (
    <div className={`verdict glass t-${d.tone === "learn" ? "learn" : d.tone}`}>
      <Ring value={v.score / 100} color={TONE_COLOR[d.tone]} label="score" size={92} stroke={8} />
      <div>
        <span className="lbl">yeppo says</span>
        <div className="v-label disp" style={{ color: TONE_COLOR[d.tone] }}>
          {d.word}
        </div>
        <p className="v-line">{d.why}</p>
        <p className="v-sub">{v.line}</p>
        {checks.length > 0 && (
          <div className="v-checks">
            {checks.map((c) => (
              <span key={c.label} className={c.ok ? "up" : "down"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="v-side">
        <div>
          <b className="mono">{k}</b> look-alikes
        </div>
        <div>
          out of <b className="mono">{n.toLocaleString("en-US")}</b> coins
        </div>
        <div>seen at {age(ageS * 1000)} old</div>
        <div className="dim2">updated {Math.max(0, Math.round(fresh))}s ago</div>
      </div>
    </div>
  );
}

export function LearningBanner({ n, need, old }: { n: number; need: number; old?: boolean }) {
  return (
    <div className="verdict glass t-learn">
      <Ring value={old ? 1 : n / need} color={TONE_COLOR.learn} label={old ? "old" : "learned"} size={92} stroke={8} />
      <div>
        <span className="lbl">The oracle says</span>
        <div className="v-label disp">{old ? "Too old to read" : "Still learning"}</div>
        <p className="v-line">
          {old
            ? "This coin is more than 40 minutes old. The oracle reads coins in their first 40 minutes, where almost all of the action is. Holders and the live play-by-play still work."
            : `yeppo has seen ${n} coins at this age so far and needs ${need} to call it. Every minute it watches about a hundred more.`}
        </p>
        {!old && (
          <div className="learn-bar">
            <i style={{ width: `${Math.min(100, (n / need) * 100)}%` }} />
          </div>
        )}
      </div>
      <div />
    </div>
  );
}

export function OddsGrid({ o, base }: { o: Odds; base: Base }) {
  const cards: { label: string; v: number; b: number; color: string; tip: string }[] = [
    { label: "went up by half", v: o.p50, b: base.p50, color: "#22e39a", tip: "Look-alikes that were up 50% at some point in the next 10 minutes" },
    { label: "doubled", v: o.p2x, b: base.p2x, color: "#ffd36b", tip: "Look-alikes that doubled at some point in the next 10 minutes" },
    { label: "crashed by half", v: o.dump, b: base.dump, color: "#ff4d6d", tip: "Look-alikes that were down 50% at some point in the next 10 minutes" },
  ];
  return (
    <div className="odds">
      {cards.map((c) => (
        <div key={c.label} className="odd glass" title={c.tip}>
          <span className="lbl">In 10 minutes</span>
          <b className="mono" style={{ color: c.color }}>
            {inTen(c.v)}
          </b>
          <span className="small">{c.label}</span>
          <span className="vs">a random coin: {inTen(c.b)}</span>
          <i className="meter" style={{ width: `${c.v * 100}%`, background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
        </div>
      ))}
      <div className="odd glass" title="The middle result of the look-alikes after 10 minutes">
        <span className="lbl">Typical result</span>
        <b className="mono" style={{ color: o.med >= 1 ? "#22e39a" : "#ff4d6d" }}>
          {mult(o.med)}
        </b>
        <span className="small">10 minutes later</span>
        <span className="vs">best moment on the way {mult(Math.max(1, o.best))}</span>
      </div>
    </div>
  );
}

export function PlainBox({ lines }: { lines: Plain[] }) {
  if (!lines.length) return null;
  return (
    <div className="panel glass plain">
      <h3>💬 In plain words</h3>
      <div className="plain-rows">
        {lines.map((l) => (
          <div key={l.title} className={`plain-row p-${l.tone}`}>
            <span className="ic">{l.icon}</span>
            <div>
              <span className="lbl">{l.title}</span>
              <p>{l.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLS: { k: keyof ReturnType<typeof exitView>; label: string; color: string }[] = [
  { k: "overdue", label: "overdue", color: "#ff4d6d" },
  { k: "s30", label: "< 30s", color: "#ff6b5a" },
  { k: "s60", label: "30-60s", color: "#ff8f45" },
  { k: "s120", label: "1-2m", color: "#ffb547" },
  { k: "s300", label: "2-5m", color: "#7dd3fc" },
  { k: "later", label: "5m+", color: "#38bdf8" },
];

export function ExitClock({ x }: { x: Extract<Xray, { tracked: true }> }) {
  const v = exitView(x);
  const soon = v.overdue + v.s30 + v.s60;
  const max = Math.max(1, ...COLS.map((c) => v[c.k] as number));
  const kinds = (Object.keys(KIND) as Kind[]).map((k) => ({ k, n: x.kinds?.[k]?.[0] ?? 0, sh: x.kinds?.[k]?.[1] ?? 0 })).filter((r) => r.n > 0);
  const kmax = Math.max(1, ...kinds.map((r) => r.sh));
  const dp = x.devpos;
  const devSold = !!dp && dp[4] > 0 && dp[1] < dp[0] * 0.1;
  return (
    <div className="panel glass">
      <h3>⏱ Exit clock</h3>
      <p className="hint">How much of the coin belongs to wallets that usually sell soon, based on how they traded before.</p>
      <div className="clock-big">
        <b className="mono" style={{ color: soon >= 10 ? "#ff4d6d" : soon >= 4 ? "#ffb547" : "#22e39a" }}>
          <Num value={soon} fmt={(s) => `${s.toFixed(1)}%`} />
        </b>
        <span className="small dim">of all the coins could be sold in the next minute</span>
      </div>
      <div className="timeline">
        {COLS.map((c) => (
          <div key={c.k} className="col">
            <span className="colv mono">{(v[c.k] as number).toFixed(1)}%</span>
            <div className="colbar" style={{ height: `${((v[c.k] as number) / max) * 80}%`, background: c.color, boxShadow: `0 0 12px ${c.color}66` }} />
          </div>
        ))}
      </div>
      <div className="timeline-x">
        {COLS.map((c) => (
          <span key={c.k}>{c.label}</span>
        ))}
      </div>
      <div className="kinds">
        {kinds.map((r) => (
          <div key={r.k} className="kind" title={KIND[r.k].hint}>
            <span>{KIND[r.k].icon}</span>
            <span>
              {KIND[r.k].label} <span className="dim">· {r.n}</span>
            </span>
            <span className="mono">{r.sh.toFixed(1)}%</span>
            <div className="kb">
              <i style={{ width: `${(r.sh / kmax) * 100}%`, background: KIND[r.k].color }} />
            </div>
          </div>
        ))}
      </div>
      {dp && (
        <div className={`devbox ${devSold ? "sold" : ""}`}>
          <span className="big">{devSold ? "🚨" : dp[4] > 0 ? "⚠️" : "👤"}</span>
          <span>
            {devSold ? (
              <>
                <b className="down">The dev sold.</b> Bought {dp[0].toFixed(1)}% of the supply, holds {dp[1].toFixed(1)}% now.
              </>
            ) : dp[4] > 0 ? (
              <>
                <b className="amber">The dev is selling.</b> {dp[1].toFixed(1)}% left of the {dp[0].toFixed(1)}% they bought.
              </>
            ) : (
              <>
                The dev still holds <b>{dp[1].toFixed(1)}%</b> of the supply and has not sold.
              </>
            )}
          </span>
        </div>
      )}
      <p className="hint" style={{ margin: "12px 0 0" }}>
        {x.known} of {x.traders} wallets that traded it have a track record with yeppo. {x.holders} hold it now.
      </p>
    </div>
  );
}

export function StoryFeed({ events, now, limit = 40, compact }: { events: StoryEvent[]; now: number; limit?: number; compact?: boolean }) {
  if (!events.length) return <p className="small dim">Waiting for the next big move…</p>;
  return (
    <div className={compact ? "mini-story" : "story"}>
      {events.slice(0, limit).map((e) => (
        <div key={e.id} className={`ev t-${e.tone}`}>
          <span className="ic">{e.icon}</span>
          <span>{e.text}</span>
          <span className="tm mono">{age(now - e.t)}</span>
        </div>
      ))}
    </div>
  );
}

export function Holders({ x }: { x: Extract<Xray, { tracked: true }> }) {
  const rows = x.top ?? [];
  if (!rows.length) return <p className="small dim">No holders yet.</p>;
  return (
    <div className="tscroll">
      <table className="htable">
        <thead>
          <tr>
            <th>Wallet</th>
            <th>Supply</th>
            <th>Kind</th>
            <th>Usually holds</th>
            <th>Wins</th>
            <th>PnL (all coins)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td className="mono">
                <a href={`https://gmgn.ai/sol/address/${r[0]}`} target="_blank" rel="noreferrer">
                  {short(r[0])} ↗
                </a>
              </td>
              <td className="mono">{r[1].toFixed(2)}%</td>
              <td>
                <span className="ktag" style={{ color: KIND[r[2]].color }}>
                  {KIND[r[2]].icon} {KIND[r[2]].label}
                </span>
              </td>
              <td className="mono">{r[7] != null ? age(r[7] * 1000) : "–"}</td>
              <td className="mono">{r[8] != null ? pct(r[8]) : "–"}</td>
              <td className={`mono ${r[9] > 0 ? "up" : r[9] < 0 ? "down" : "dim"}`}>
                {r[6] ? `${r[9] > 0 ? "+" : ""}${r[9].toFixed(2)} SOL` : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Flags({ list }: { list: Flag[] }) {
  if (!list.length) return null;
  return (
    <div className="flags">
      {list.map((f) => (
        <div key={f.text} className={`flag f-${f.tone}`}>
          <span className="ic">{f.icon}</span>
          <span>{f.text}</span>
        </div>
      ))}
    </div>
  );
}

/** the creator's record: every coin of theirs yeppo followed to the end, and the ones live now */
export function DevCard({ dev, d, sol }: { dev: string | null; d: DevHist | null; sol: number }) {
  if (!dev) return null;
  const rugger = isRugger(d);
  const done = d?.coins ?? 0;
  return (
    <div className={`panel glass devcard ${rugger ? "bad" : ""}`}>
      <h3>👤 Dev record</h3>
      <p className="hint">
        Every coin from this creator that yeppo followed to the end{d?.since ? `, since ${new Date(d.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.
      </p>
      <div className="dev-stats">
        <div>
          <b className="mono">{done}</b>
          <span>coins</span>
        </div>
        <div>
          <b className={`mono ${d?.rugs ? "down" : ""}`}>{d?.rugs ?? 0}</b>
          <span>rugged</span>
        </div>
        <div>
          <b className="mono">{d?.dead ?? 0}</b>
          <span>died</span>
        </div>
        <div>
          <b className={`mono ${d?.grads ? "up" : ""}`}>{d?.grads ?? 0}</b>
          <span>went big</span>
        </div>
      </div>
      <p className="small" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
        {rugger ? (
          <b className="down">Serial rugger. Stay away.</b>
        ) : done === 0 ? (
          <span className="dim">No finished coin from this dev yet{d?.live ? `, ${d.live} other live now` : ""}. First coin or a new wallet.</span>
        ) : (
          <span className="dim">
            Best high {d?.best ? `$${Math.round((d.best * sol) / 1000)}k` : "–"}
            {d?.live ? ` · ${d.live} other coin${d.live > 1 ? "s" : ""} live now${d.live_sold ? `, ${d.live_sold} already sold by the dev` : ""}` : ""}.
          </span>
        )}
      </p>
      <a className="small dim" href={`https://gmgn.ai/sol/address/${dev}`} target="_blank" rel="noreferrer">
        {short(dev)} on GMGN ↗
      </a>
    </div>
  );
}
