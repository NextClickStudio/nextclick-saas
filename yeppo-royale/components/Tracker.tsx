"use client";

import { age, clock, pct, sol } from "@/lib/format";
import { short } from "@/lib/wallet";
import type { RealDuel } from "@/lib/types";
import Avatar from "./Avatar";

/** the floating scoreboard: small enough to sit on top of pump.fun, Axiom or GMGN */
export function MiniTracker({ d, sNow, pop }: { d: RealDuel; sNow: number; pop?: boolean }) {
  const me = d.me ?? 1;
  const opp = 3 - me;
  const sMe = d.score?.[me - 1] ?? null;
  const sOpp = d.score?.[opp - 1] ?? null;
  const pMe = me === 1 ? d.p1 : d.p2;
  const pOpp = me === 1 ? d.p2 : d.p1;
  const rMe = sMe?.roi ?? 0;
  const rOpp = sOpp?.roi ?? 0;
  const pre = d.start != null && sNow < d.start;
  const left = d.end != null ? d.end - sNow : 0;
  const diff = Math.max(-1, Math.min(1, rMe - rOpp));
  const share = 50 + diff * 45;
  const last = [...d.trades].sort((a, b) => b[5] - a[5])[0];
  const freshest = Math.max(0, ...Object.values(d.polled ?? {}));
  const lastSym = last ? d.mints[last[1]]?.symbol : null;
  return (
    <div className={`mini ${pop ? "pop" : ""}`}>
      <div className="mini-top">
        <span className="lbl">
          <span className="chain-dot" /> yeppo real duel
        </span>
        <b className={`mono mini-clock ${!pre && left < 60_000 && d.status === "live" ? "hot" : ""}`}>
          {d.status === "done" ? "FINAL" : pre ? `in ${clock(d.start! - sNow)}` : left > 0 ? clock(left) : "settling"}
        </b>
      </div>
      <div className="mini-score">
        <div className="mini-side">
          <Avatar look={pMe?.avatar} size={26} />
          <span className="small">{d.me ? "You" : pMe?.name}</span>
          <b className={`mono ${rMe >= 0 ? "t-up" : "t-down"}`}>{sMe?.roi != null ? pct(sMe.roi * 100, 1) : "—"}</b>
        </div>
        <span className="mini-vs dim">vs</span>
        <div className="mini-side r">
          <b className={`mono ${rOpp >= 0 ? "t-up" : "t-down"}`}>{sOpp?.roi != null ? pct(sOpp.roi * 100, 1) : "—"}</b>
          <span className="small">{pOpp?.name ?? "…"}</span>
          <Avatar look={pOpp?.avatar} size={26} />
        </div>
      </div>
      <div className="tug mini-tug">
        <div className="tug-a" style={{ width: `${share}%` }} />
        <div className="tug-b" style={{ width: `${100 - share}%` }} />
        <div className="tug-knot" style={{ left: `${share}%` }} />
      </div>
      <div className="mini-last small">
        {last ? (
          <>
            <span className={last[0] === me ? "t-gold" : "t-violet"}>{last[0] === me ? "You" : pOpp?.name}</span>{" "}
            {last[2] === 1 ? "bought" : "sold"} <b className="mono">{sol(last[3], 2)} SOL</b> {lastSym ? `$${lastSym.slice(0, 10)}` : short(last[1])}{" "}
            <span className="dim">{age(sNow - last[5])} ago</span>
          </>
        ) : (
          <span className="dim">No trades yet. Trades from both wallets show up here.</span>
        )}
      </div>
      <div className="mini-foot small dim">{freshest ? `chain sync ${age(sNow - freshest)} ago` : "waiting for the first chain sync"}</div>
    </div>
  );
}

/** a Document Picture-in-Picture window (Chrome, Edge, Brave, Arc) with yeppo's styles copied in */
export async function openPip(width = 360, height = 230): Promise<Window | null> {
  const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window> } }).documentPictureInPicture;
  if (!dpip) return null;
  const win = await dpip.requestWindow({ width, height });
  for (const ss of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(ss.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const el = win.document.createElement("style");
      el.textContent = css;
      win.document.head.appendChild(el);
    } catch {
      if (ss.href) {
        const l = win.document.createElement("link");
        l.rel = "stylesheet";
        l.href = ss.href;
        win.document.head.appendChild(l);
      }
    }
  }
  win.document.documentElement.className = document.documentElement.className;
  win.document.body.className = "pip-body";
  return win;
}
