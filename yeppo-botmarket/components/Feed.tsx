"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ago, assetPrice, pct, pts } from "@/lib/format";
import { STRATEGIES } from "@/lib/strategy";
import type { Activity } from "@/lib/types";

function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const T = ({ a }: { a: Activity }) =>
  a.ticker ? (
    <Link href={`/bot/${a.ticker}`} className="tkr">
      ${a.ticker}
    </Link>
  ) : null;

function Row({ a, now }: { a: Activity; now: number }) {
  const d = a.data ?? {};
  let icon = "·";
  let cls = "";
  let body: React.ReactNode;
  let right: React.ReactNode = null;
  switch (a.kind) {
    case "ipo":
      icon = "◆";
      cls = "k-ipo";
      body = (
        <>
          <T a={a} /> listed by @{a.handle}
          <small>
            {STRATEGIES[d.strategy as keyof typeof STRATEGIES]?.name ?? d.strategy} · {d.asset} {d.tf}
          </small>
        </>
      );
      right = <span className="tag tag-new">IPO</span>;
      break;
    case "buy":
    case "sell":
      icon = a.kind === "buy" ? "▲" : "▼";
      cls = a.kind === "buy" ? "k-buy" : "k-sell";
      body = (
        <>
          @{a.handle} {a.kind === "buy" ? "bought" : "sold"} <span className="mono">{pts(d.shares)}</span> <T a={a} />
        </>
      );
      right = <span className="mono">{pts(d.pts)}</span>;
      break;
    case "open":
      icon = d.side === "long" ? "↗" : "↘";
      cls = "k-open";
      body = (
        <>
          <T a={a} /> opened {String(d.side).toUpperCase()} {d.lev}x {d.asset}
          <small className="mono">@ {assetPrice(d.entry)}</small>
        </>
      );
      break;
    case "close": {
      const win = Number(d.pct) >= 0;
      icon = win ? "✓" : "✕";
      cls = win ? "k-win" : "k-loss";
      body = (
        <>
          <T a={a} /> closed <b className={`mono t-${win ? "up" : "down"}`}>{pct(d.pct)}</b>
          <small>{d.reason}</small>
        </>
      );
      right = Number(d.dividend) > 0 ? <span className="mono t-gold">+{pts(d.dividend)}</span> : null;
      break;
    }
    case "rekt":
      icon = "☠";
      cls = "k-loss";
      body = (
        <>
          <T a={a} /> got rekt
        </>
      );
      break;
    case "join":
      icon = "+";
      cls = "k-join";
      body = <>@{a.handle} joined</>;
      break;
    default:
      return null;
  }
  return (
    <div className={`feed-row ${cls}`}>
      <span className="feed-ic">{icon}</span>
      <span className="feed-body">{body}</span>
      <span className="feed-right">
        {right}
        <time className="mono">{ago(a.created_at, now)}</time>
      </span>
    </div>
  );
}

export default function Feed({ items, title = "Live activity", empty = "Waiting for the first move…" }: { items: Activity[]; title?: string; empty?: string }) {
  const now = useNow();
  return (
    <section className="panel feed">
      <div className="panel-head">
        <span className="lbl">
          <i className="live" /> {title}
        </span>
      </div>
      <div className="feed-rows">
        {items.length ? items.map((a) => <Row key={a.id} a={a} now={now} />) : <div className="empty">{empty}</div>}
      </div>
    </section>
  );
}
