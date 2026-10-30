"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mult, usd } from "@/lib/format";
import type { Cone } from "@/lib/oracle";
import type { Match } from "@/lib/types";

export type Pt = { s: number; mc: number }; // seconds since birth, market cap in SOL

const FUTURE_S = 600; // the look-alikes' next 10 minutes
const STEP_S = 20;
const PAST_W = 0.58; // share of the width for the past

type Props = {
  past: Pt[];
  nowS: number;
  mcNow: number;
  matches: Match[] | null;
  cone: Cone | null;
  sol: number;
  hi: number | null;
  onHi: (i: number | null) => void;
  height?: number;
};

const ghostColor = (m: Match) => {
  const end = m[4][m[4].length - 1] ?? 1;
  if (end >= 1.5) return [34, 227, 154];
  if (end <= 0.5) return [255, 77, 109];
  return [160, 168, 190];
};

export default function FutureChart({ past, nowS, mcNow, matches, cone, sol, hi, onHi }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tip, setTip] = useState<{ x: number; y: number; html: React.ReactNode } | null>(null);
  const prog = useRef(1);
  const lastSet = useRef("");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // geometry shared by drawing and hovering
  const geo = useMemo(() => {
    const { w, h } = size;
    const padL = 8;
    const padR = 66;
    const padT = 16;
    const padB = 26;
    const W = Math.max(10, w - padL - padR);
    const H = Math.max(10, h - padT - padB);
    const window = Math.min(Math.max(nowS, 60), 15 * 60);
    const x0 = Math.max(0, nowS - window);
    const xOf = (s: number) =>
      s <= nowS ? padL + ((s - x0) / Math.max(1, nowS - x0)) * W * PAST_W : padL + W * PAST_W + ((s - nowS) / FUTURE_S) * W * (1 - PAST_W);
    let lo = Infinity;
    let hiV = -Infinity;
    for (const p of past) {
      if (p.s < x0) continue;
      lo = Math.min(lo, p.mc);
      hiV = Math.max(hiV, p.mc);
    }
    if (mcNow > 0) {
      lo = Math.min(lo, mcNow);
      hiV = Math.max(hiV, mcNow);
    }
    if (cone && mcNow > 0) {
      lo = Math.min(lo, mcNow * Math.min(...cone.q10));
      hiV = Math.max(hiV, mcNow * Math.max(...cone.q90));
    }
    if (!Number.isFinite(lo)) {
      lo = 25;
      hiV = 60;
    }
    lo = Math.max(lo * 0.9, 1);
    hiV = Math.max(hiV * 1.1, lo * 1.3);
    const ll = Math.log(lo);
    const lh = Math.log(hiV);
    const yOf = (mc: number) => padT + H - ((Math.log(Math.max(mc, 1e-6)) - ll) / (lh - ll)) * H;
    const mcOf = (y: number) => Math.exp(ll + ((padT + H - y) / H) * (lh - ll));
    return { padL, padR, padT, padB, W, H, x0, xOf, yOf, mcOf, lo, hi: hiV, xNow: padL + W * PAST_W };
  }, [size, past, nowS, mcNow, cone]);

  // re-draw the ghosts from scratch when the set of look-alikes changes
  useEffect(() => {
    const key = (matches ?? []).map((m) => m[0]).join(",");
    const prev = new Set(lastSet.current.split(","));
    const changed = (matches ?? []).filter((m) => !prev.has(m[0])).length;
    lastSet.current = key;
    if (matches && changed > matches.length * 0.3) prog.current = 0;
  }, [matches]);

  useEffect(() => {
    const c = cv.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const g = c.getContext("2d")!;
    let raf = 0;
    const start = performance.now();
    const from = prog.current;

    const draw = () => {
      const { padL, padT, W, H, xOf, yOf, x0, lo, hi: hiV, xNow } = geo;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size.w, size.h);

      // future zone
      const fz = g.createLinearGradient(xNow, 0, padL + W, 0);
      fz.addColorStop(0, "rgba(139,92,255,0.13)");
      fz.addColorStop(1, "rgba(56,225,255,0.02)");
      g.fillStyle = fz;
      g.fillRect(xNow, padT, padL + W - xNow, H);

      // price grid (log), labelled in USD
      g.font = "11px ui-monospace, monospace";
      g.textBaseline = "middle";
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const mc = Math.exp(Math.log(lo) + ((Math.log(hiV) - Math.log(lo)) * i) / steps);
        const y = yOf(mc);
        g.strokeStyle = "rgba(255,255,255,0.05)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(padL, y);
        g.lineTo(padL + W, y);
        g.stroke();
        g.fillStyle = "rgba(141,149,169,0.9)";
        g.fillText(usd(mc * sol), padL + W + 8, y);
      }
      // time axis
      g.textBaseline = "top";
      g.fillStyle = "rgba(141,149,169,0.75)";
      const lab = (s: number, txt: string) => {
        const x = xOf(s);
        g.fillText(txt, Math.min(Math.max(x - 14, padL), padL + W - 30), padT + H + 8);
      };
      lab(x0, x0 === 0 ? "birth" : `${Math.round(x0 / 60)}m`);
      lab(nowS + 300, "+5m");
      lab(nowS + 600, "+10m");

      if (mcNow > 0) {
        // reference levels
        for (const [m, txt, col] of [
          [2, "2x", "rgba(255,211,107,0.55)"],
          [1.5, "+50%", "rgba(34,227,154,0.45)"],
          [0.5, "−50%", "rgba(255,77,109,0.5)"],
        ] as const) {
          const y = yOf(mcNow * m);
          if (y < padT || y > padT + H) continue;
          g.setLineDash([4, 5]);
          g.strokeStyle = col;
          g.beginPath();
          g.moveTo(xNow, y);
          g.lineTo(padL + W, y);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = col;
          g.textBaseline = "bottom";
          g.fillText(txt, padL + W - 34, y - 2);
        }
      }

      // the past
      const pts = past.filter((p) => p.s >= x0 - 10);
      if (pts.length) {
        const path = new Path2D();
        pts.forEach((p, i) => (i ? path.lineTo(xOf(p.s), yOf(p.mc)) : path.moveTo(xOf(p.s), yOf(p.mc))));
        if (mcNow > 0) path.lineTo(xNow, yOf(mcNow));
        const area = new Path2D(path);
        area.lineTo(xNow, padT + H);
        area.lineTo(xOf(pts[0].s), padT + H);
        area.closePath();
        const ag = g.createLinearGradient(0, padT, 0, padT + H);
        ag.addColorStop(0, "rgba(56,225,255,0.22)");
        ag.addColorStop(1, "rgba(56,225,255,0)");
        g.fillStyle = ag;
        g.fill(area);
        const lg = g.createLinearGradient(padL, 0, xNow, 0);
        lg.addColorStop(0, "#38e1ff");
        lg.addColorStop(1, "#b9a4ff");
        g.strokeStyle = lg;
        g.lineWidth = 2.2;
        g.lineJoin = "round";
        g.shadowColor = "rgba(56,225,255,0.6)";
        g.shadowBlur = 10;
        g.stroke(path);
        g.shadowBlur = 0;
      }

      const p = Math.min(1, prog.current);
      g.save();
      g.beginPath();
      g.rect(xNow, padT, padL + W - xNow + 1, H);
      g.clip();
      if (matches && mcNow > 0) {
        // ghost futures
        matches.forEach((m, mi) => {
          if (mi === hi) return;
          const [r, gg, b] = ghostColor(m);
          g.strokeStyle = `rgba(${r},${gg},${b},${hi == null ? 0.26 : 0.1})`;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(xNow, yOf(mcNow));
          const n = Math.max(1, Math.floor(m[4].length * p));
          for (let i = 0; i < n; i++) g.lineTo(xOf(nowS + (i + 1) * STEP_S), yOf(mcNow * m[4][i]));
          g.stroke();
        });
      }
      if (cone && mcNow > 0) {
        const band = (a: number[], b: number[], fill: string) => {
          const n = Math.max(1, Math.floor(a.length * p));
          g.beginPath();
          g.moveTo(xNow, yOf(mcNow));
          for (let i = 0; i < n; i++) g.lineTo(xOf(nowS + (i + 1) * STEP_S), yOf(mcNow * a[i]));
          for (let i = n - 1; i >= 0; i--) g.lineTo(xOf(nowS + (i + 1) * STEP_S), yOf(mcNow * b[i]));
          g.closePath();
          g.fillStyle = fill;
          g.fill();
        };
        band(cone.q90, cone.q10, "rgba(139,92,255,0.11)");
        band(cone.q75, cone.q25, "rgba(139,92,255,0.2)");
        const n = Math.max(1, Math.floor(cone.q50.length * p));
        g.setLineDash([6, 5]);
        g.strokeStyle = "rgba(238,241,248,0.92)";
        g.lineWidth = 2;
        g.shadowColor = "rgba(185,164,255,0.9)";
        g.shadowBlur = 8;
        g.beginPath();
        g.moveTo(xNow, yOf(mcNow));
        for (let i = 0; i < n; i++) g.lineTo(xOf(nowS + (i + 1) * STEP_S), yOf(mcNow * cone.q50[i]));
        g.stroke();
        g.setLineDash([]);
        g.shadowBlur = 0;
      }
      if (matches && hi != null && matches[hi] && mcNow > 0) {
        const m = matches[hi];
        const [r, gg, b] = ghostColor(m);
        g.strokeStyle = `rgb(${r},${gg},${b})`;
        g.lineWidth = 2.6;
        g.shadowColor = `rgb(${r},${gg},${b})`;
        g.shadowBlur = 12;
        g.beginPath();
        g.moveTo(xNow, yOf(mcNow));
        m[4].forEach((v, i) => g.lineTo(xOf(nowS + (i + 1) * STEP_S), yOf(mcNow * v)));
        g.stroke();
        g.shadowBlur = 0;
      }
      g.restore();

      // now
      g.strokeStyle = "rgba(185,164,255,0.7)";
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(xNow, padT);
      g.lineTo(xNow, padT + H);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(185,164,255,0.95)";
      g.textBaseline = "top";
      g.fillText("NOW", xNow + 6, padT + 2);
      g.fillStyle = "rgba(185,164,255,0.55)";
      g.fillText("THE NEXT 10 MINUTES OF THE LOOK-ALIKES", Math.min(xNow + 6, padL + W - 250), padT + 16);
      if (mcNow > 0) {
        const y = yOf(mcNow);
        const t = performance.now() / 1000;
        const pulse = 6 + Math.sin(t * 4) * 2.5;
        g.fillStyle = "rgba(185,164,255,0.25)";
        g.beginPath();
        g.arc(xNow, y, pulse + 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(xNow, y, 4, 0, Math.PI * 2);
        g.fill();
      }
    };

    let last = 0;
    const loop = (t: number) => {
      prog.current = Math.min(1, from + (t - start) / 1100);
      // full speed while the ghosts draw in, then just enough for the pulse
      if (prog.current < 1 || t - last > 60) {
        last = t;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [geo, size, past, nowS, mcNow, matches, cone, sol, hi]);

  const move = (e: React.MouseEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const { xNow, xOf, yOf, mcOf, padL, W } = geo;
    if (x > xNow && matches && matches.length && mcNow > 0) {
      const i = Math.max(0, Math.min(29, Math.round(((x - xNow) / (padL + W - xNow)) * 30) - 1));
      let best = 0;
      let bd = Infinity;
      matches.forEach((m, mi) => {
        const d = Math.abs(yOf(mcNow * (m[4][i] ?? 1)) - y);
        if (d < bd) {
          bd = d;
          best = mi;
        }
      });
      onHi(bd < 26 ? best : null);
      const m = matches[best];
      setTip(
        bd < 26
          ? {
              x: xOf(nowS + (i + 1) * STEP_S),
              y: yOf(mcNow * m[4][i]),
              html: (
                <>
                  <b>{m[5] ? `$${m[5]}` : "A look-alike"}</b> after {Math.round(((i + 1) * STEP_S) / 60 * 10) / 10} min:{" "}
                  <b className={m[4][i] >= 1 ? "up" : "down"}>{mult(m[4][i])}</b>
                  <br />
                  <span className="dim">
                    best {mult(Math.max(1, m[2]))} · worst {mult(m[3])}
                  </span>
                </>
              ),
            }
          : {
              x,
              y,
              html: (
                <>
                  {usd(mcOf(y) * sol)} <span className="dim">· {mult(mcOf(y) / mcNow)} from now</span>
                </>
              ),
            },
      );
    } else {
      onHi(null);
      setTip({ x, y, html: <>{usd(mcOf(y) * sol)}</> });
    }
  };

  return (
    <div className="chart-wrap" ref={wrap} onMouseMove={move} onMouseLeave={() => (onHi(null), setTip(null))}>
      <canvas ref={cv} />
      {tip && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.html}
        </div>
      )}
    </div>
  );
}
