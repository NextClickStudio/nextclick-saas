"use client";

// The moving background on every page: three slow colour blobs, a grid that drifts down, and a field of tiny
// ticks rising like trades (green buys, red sells). It stops when the tab is hidden or motion is reduced.
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
    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
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
