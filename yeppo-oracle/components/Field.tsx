"use client";

// The page's living background: faint price lines drifting left like a wall of charts, a glow that follows
// the pointer, and a grain on top. Still on reduced motion, paused while the tab is hidden.
import { useEffect, useRef } from "react";

type Line = { y: number; amp: number; speed: number; t: number; hue: number; alpha: number; pts: number[] };

export default function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let lines: Line[] = [];
    let raf = 0;
    let mx = -1e4;
    let my = -1e4;
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const STEP = 14;

    const build = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const n = Math.round(Math.min(22, Math.max(11, h / 52)));
      lines = Array.from({ length: n }, (_, i) => {
        const pts: number[] = [];
        let v = 0;
        for (let x = 0; x <= w + STEP * 2; x += STEP) {
          v += (rnd() - 0.5) * 2.2;
          v *= 0.96;
          pts.push(v);
        }
        return { y: ((i + 0.5) / n) * h, amp: 6 + rnd() * 16, speed: 0.12 + rnd() * 0.3, t: rnd() * STEP, hue: rnd() < 0.5 ? 258 : 190, alpha: 0.1 + rnd() * 0.14, pts };
      });
    };
    const step = () => {
      // each line walks left; a whole step drops its first point and adds a fresh one on the right
      for (const l of lines) {
        l.t += l.speed;
        while (l.t >= STEP) {
          l.t -= STEP;
          l.pts.shift();
          l.pts.push((l.pts[l.pts.length - 1] + (rnd() - 0.5) * 2.2) * 0.96);
        }
      }
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const l of lines) {
        const shift = l.t;
        ctx.beginPath();
        for (let i = 0; i < l.pts.length; i++) {
          const x = i * STEP - shift;
          const y = l.y + l.pts[i] * l.amp * 0.3;
          const near = Math.max(0, 1 - Math.hypot(x - mx, y - my) / 260);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y - near * 10);
        }
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, `hsla(${l.hue}, 90%, 70%, 0)`);
        g.addColorStop(0.5, `hsla(${l.hue}, 90%, 70%, ${l.alpha})`);
        g.addColorStop(1, `hsla(${l.hue}, 90%, 70%, ${l.alpha * 1.6})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    };
    const loop = () => {
      step();
      draw();
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--my", `${e.clientY}px`);
    };
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) raf = requestAnimationFrame(loop);
    };
    build();
    draw();
    if (!still) raf = requestAnimationFrame(loop);
    window.addEventListener("resize", build);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", build);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return (
    <div className="field" aria-hidden>
      <canvas ref={ref} />
      <div className="field-glow" />
      <div className="field-grain" />
    </div>
  );
}
