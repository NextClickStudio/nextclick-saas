"use client";

import { useEffect, useRef } from "react";
import { hashStr } from "@/lib/rng";

export type Blip = { id: string; label: string; up: boolean; age: number };

/**
 * The matchmaking scope: a rotating sweep over live pump.fun launches.
 * Searching speeds the sweep up and sends rings out from the centre.
 */
export default function Radar({ blips, searching, size = 380 }: { blips: Blip[]; searching: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ blips, searching });
  state.current = { blips, searching };

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr;
    cv.height = size * dpr;
    let raf = 0;
    let angle = -Math.PI / 2;
    let last = performance.now();
    let speed = 0.9;
    const rings: number[] = [];
    let ringClock = 0;
    const lit = new Map<string, number>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { blips: bs, searching: s } = state.current;
      speed += ((s ? 4.2 : 0.9) - speed) * Math.min(1, dt * 3);
      if (!reduce) angle += speed * dt;
      const c = size / 2;
      const R = c - 8;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // body
      const bg = ctx.createRadialGradient(c, c, 0, c, c, R);
      bg.addColorStop(0, "rgba(16,212,142,0.07)");
      bg.addColorStop(1, "rgba(16,212,142,0.01)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fill();

      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(c, c, (R * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(c - R, c);
      ctx.lineTo(c + R, c);
      ctx.moveTo(c, c - R);
      ctx.lineTo(c, c + R);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const l = i % 6 === 0 ? 8 : 4;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        ctx.lineTo(c + Math.cos(a) * (R - l), c + Math.sin(a) * (R - l));
        ctx.stroke();
      }

      // sweep
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(angle - Math.PI * 0.5, c, c);
        g.addColorStop(0, "rgba(16,212,142,0)");
        g.addColorStop(0.2, "rgba(16,212,142,0.02)");
        g.addColorStop(0.245, s ? "rgba(16,212,142,0.32)" : "rgba(16,212,142,0.22)");
        g.addColorStop(0.25, "rgba(16,212,142,0)");
        g.addColorStop(1, "rgba(16,212,142,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c, c, R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(16,212,142,0.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(angle) * R, c + Math.sin(angle) * R);
      ctx.stroke();

      // search rings
      if (s) {
        ringClock += dt;
        if (ringClock > 0.55) {
          ringClock = 0;
          rings.push(0);
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i] += dt * 0.9;
        const p = rings[i];
        if (p >= 1) {
          rings.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(16,212,142,${0.45 * (1 - p)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c, c, R * p, 0, Math.PI * 2);
        ctx.stroke();
      }

      // blips: live launches, placed by name, newer ones nearer the centre
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      for (const b of bs) {
        const h = hashStr(b.id);
        const a = ((h % 3600) / 3600) * Math.PI * 2;
        const rr = R * (0.44 + 0.48 * Math.min(1, b.age / 900_000)) * (0.94 + ((h >> 12) % 100) / 1600);
        const x = c + Math.cos(a) * rr;
        const y = c + Math.sin(a) * rr;
        let diff = (angle - a) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (diff < 0.08) lit.set(b.id, now);
        const since = (now - (lit.get(b.id) ?? -1e9)) / 1000;
        const glow = Math.max(0.18, 1 - since / 2.6);
        const col = b.up ? "16,212,142" : "246,70,93";
        ctx.fillStyle = `rgba(${col},${glow * 0.25})`;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${col},${0.35 + glow * 0.65})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (glow > 0.3) {
          ctx.fillStyle = `rgba(230,232,235,${glow * 0.85})`;
          ctx.fillText(b.label, x + 7, y - 6);
        }
      }

      // centre
      ctx.fillStyle = "rgba(16,212,142,0.9)";
      ctx.beginPath();
      ctx.arc(c, c, 3, 0, Math.PI * 2);
      ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} className="radar" style={{ width: size, height: size }} aria-hidden />;
}
