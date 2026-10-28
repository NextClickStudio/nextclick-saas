"use client";

import { useEffect, useRef, useState } from "react";
import type { FxKind } from "@/lib/fx";

type ToastItem = { id: number; text: string; kind: FxKind };
type FloatItem = { id: number; text: string; x: number; y: number; kind: FxKind };
type Particle = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number };

const COLORS = ["#c6ff1a", "#2ef2ff", "#ff2d75", "#a05cff", "#ffd60a", "#ffffff"];
let seq = 0;

export default function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [edge, setEdge] = useState<{ id: number; kind: "up" | "down" } | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let parts: Particle[] = [];
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
    };
    resize();

    const loop = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.vy += 0.22;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    };

    const onConfetti = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; y?: number }>).detail ?? {};
      const x = d.x ?? window.innerWidth / 2;
      const y = d.y ?? window.innerHeight / 2;
      for (let i = 0; i < 140; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 4 + Math.random() * 9;
        parts.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 6,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          w: 4 + Math.random() * 5,
          h: 2 + Math.random() * 4,
          c: COLORS[i % COLORS.length],
          life: 80 + Math.random() * 60,
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; kind: FxKind }>).detail;
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, ...d }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    const onFloat = (e: Event) => {
      const d = (e as CustomEvent<Omit<FloatItem, "id">>).detail;
      const id = ++seq;
      setFloats((f) => [...f, { id, ...d }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1500);
    };
    const onEdge = (e: Event) => {
      const d = (e as CustomEvent<{ kind: "up" | "down" }>).detail;
      setEdge({ id: ++seq, kind: d.kind });
    };

    window.addEventListener("resize", resize);
    window.addEventListener("yeppo:confetti", onConfetti);
    window.addEventListener("yeppo:toast", onToast);
    window.addEventListener("yeppo:float", onFloat);
    window.addEventListener("yeppo:edge", onEdge);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("yeppo:confetti", onConfetti);
      window.removeEventListener("yeppo:toast", onToast);
      window.removeEventListener("yeppo:float", onFloat);
      window.removeEventListener("yeppo:edge", onEdge);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden />
      {edge && <div key={edge.id} className={`fx-edge fx-edge-${edge.kind}`} aria-hidden />}
      {floats.map((f) => (
        <div key={f.id} className={`fx-float fx-${f.kind}`} style={{ left: f.x, top: f.y }} aria-hidden>
          {f.text}
        </div>
      ))}
      <div className="fx-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`fx-toast fx-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
