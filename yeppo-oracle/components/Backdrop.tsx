"use client";

// The moving background on every page: three slow colour blobs, a grid that drifts down, a field of tiny ticks rising
// like trades (green buys, red sells), a faint price line scrolling along the bottom, a slow "bubble map" of linked
// wallets and the odd radar ping. All very faint. It stops when the tab is hidden or motion is reduced; inside the
// extension's panel only the ticks run.
import { useEffect, useRef } from "react";

export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const size = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener("resize", size);
    const N = Math.round(Math.min(70, (w * h) / 22000));
    const dots = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      v: 0.12 + Math.random() * 0.35,
      len: 4 + Math.random() * 14,
      up: Math.random() > 0.38,
      a: 0.08 + Math.random() * 0.22,
    }));
    const rich = !location.pathname.startsWith("/panel");
    // bubble map: a few wallets drifting, linked when close
    const nodes = Array.from({ length: rich ? Math.round(Math.min(18, w / 80)) : 0 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: 2 + Math.random() * 5,
    }));
    // price line: a random walk that scrolls left
    const STEP = 14;
    const pts: number[] = [];
    let level = 0.5;
    const nextPt = () => {
      level = Math.min(0.9, Math.max(0.1, level + (Math.random() - 0.47) * 0.09));
      return level;
    };
    for (let i = 0; i < Math.ceil(w / STEP) + 2; i++) pts.push(nextPt());
    let shift = 0;
    // radar pings
    const pings: { x: number; y: number; t: number }[] = [];
    let nextPing = performance.now() + 2500;
    let raf = 0;
    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      if (rich) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20 || n.x > w + 20) n.vx *= -1;
          if (n.y < -20 || n.y > h + 20) n.vy *= -1;
        }
        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++)
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 190) {
              ctx.strokeStyle = `rgba(154,133,255,${0.14 * (1 - d / 190)})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        for (const n of nodes) {
          ctx.fillStyle = "rgba(154,133,255,0.10)";
          ctx.strokeStyle = "rgba(154,133,255,0.22)";
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        // the price line, in the lower third
        shift += 0.25;
        if (shift >= STEP) {
          shift -= STEP;
          pts.shift();
          pts.push(nextPt());
        }
        const base = h * 0.62;
        const amp = h * 0.3;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "rgba(31,212,124,0)");
        grad.addColorStop(0.7, "rgba(31,212,124,0.18)");
        grad.addColorStop(1, "rgba(31,212,124,0.34)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach((v, i) => {
          const x = i * STEP - shift;
          const y = base + (0.5 - v) * amp;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        const lx = (pts.length - 1) * STEP - shift;
        const ly = base + (0.5 - pts[pts.length - 1]) * amp;
        if (lx > w) {
          // the head sits at the right edge: a soft glowing dot
          const hx = w - 6;
          const k = (w - 6 - (pts.length - 2) * STEP + shift) / STEP;
          const hy = base + (0.5 - (pts[pts.length - 2] + (pts[pts.length - 1] - pts[pts.length - 2]) * k)) * amp;
          ctx.fillStyle = "rgba(31,212,124,0.35)";
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(31,212,124,0.35)";
          ctx.beginPath();
          ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // radar pings, one every few seconds
        if (now > nextPing) {
          pings.push({ x: Math.random() * w, y: Math.random() * h * 0.8, t: now });
          nextPing = now + 3500 + Math.random() * 3000;
        }
        for (let i = pings.length - 1; i >= 0; i--) {
          const age = (now - pings[i].t) / 2600;
          if (age >= 1) {
            pings.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(69,214,255,${0.24 * (1 - age)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pings[i].x, pings[i].y, 6 + age * 70, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      for (const d of dots) {
        d.y -= d.v;
        if (d.y < -d.len) {
          d.y = h + d.len;
          d.x = Math.random() * w;
          d.up = Math.random() > 0.38;
        }
        const fade = Math.min(1, d.y / (h * 0.35));
        ctx.strokeStyle = d.up ? `rgba(31,212,124,${d.a * fade})` : `rgba(255,91,61,${d.a * fade})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return (
    <div className="bd" aria-hidden>
      <div className="bd-blob b1" />
      <div className="bd-blob b2" />
      <div className="bd-blob b3" />
      <div className="bd-grid" />
      <canvas ref={ref} />
      <div className="bd-noise" />
    </div>
  );
}
