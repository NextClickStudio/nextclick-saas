"use client";

// The home's instrument: yeppo's own mark (a ring, a quarter sweep, a dot) turned into a working radar scope. Wallets
// are blips that light up as the beam passes them. Every few seconds an example coin is read: the wallets that bought
// together are pulled into a group, wired up and labelled, and the scope stamps the word. The pointer is a reticle:
// near a blip it reads that wallet. One canvas, no library; it sleeps when off screen.
import { useEffect, useRef } from "react";

type Coin = { sym: string; word: "Safe" | "Risky" | "Danger"; k: number; why: string };
// example coins (the scope says "example" in its corner): the groups and numbers are the kind yeppo reports
const COINS: Coin[] = [
  { sym: "$GOAT", word: "Danger", k: 7, why: "7 wallets · same block · 38%" },
  { sym: "$SEAL", word: "Safe", k: 3, why: "3 wallets · 2.1% · an exchange paid them" },
  { sym: "$BOOK", word: "Risky", k: 5, why: "5 wallets · 0.782 SOL each · 9.4%" },
  { sym: "$MOTH", word: "Danger", k: 6, why: "funder rugged 14 coins" },
  { sym: "$KITE", word: "Safe", k: 2, why: "2 wallets · 0.8% · nothing linked" },
];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type Blip = { r: number; a: number; x: number; y: number; hx: number; hy: number; lit: number; id: string; sol: number; g: number };

export default function Scope() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const C = {
      fg: css.getPropertyValue("--fg").trim() || "#f2f1ec",
      up: css.getPropertyValue("--up").trim() || "#9be3b4",
      mid: css.getPropertyValue("--mid").trim() || "#e7b56a",
      down: css.getPropertyValue("--down").trim() || "#f08a7e",
    };
    const tone = (w: Coin["word"]) => (w === "Safe" ? C.up : w === "Risky" ? C.mid : C.down);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const addr = () => Array.from({ length: 4 }, () => B58[Math.floor(rnd() * 58)]).join("") + "…" + Array.from({ length: 3 }, () => B58[Math.floor(rnd() * 58)]).join("");
    const blips: Blip[] = Array.from({ length: 96 }, () => {
      const r = 0.12 + Math.sqrt(rnd()) * 0.84;
      const a = rnd() * Math.PI * 2;
      return { r, a, x: 0, y: 0, hx: Math.cos(a) * r, hy: Math.sin(a) * r, lit: -9, id: addr(), sol: Math.round((0.05 + rnd() * rnd() * 4) * 1000) / 1000, g: -1 };
    });
    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
    const fit = () => {
      const b = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = b.width;
      H = b.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      R = Math.min(W, H) / 2 - 26;
      cx = W / 2;
      cy = H / 2;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    let mx = -1e4, my = -1e4;
    const move = (e: PointerEvent) => {
      const b = cv.getBoundingClientRect();
      mx = e.clientX - b.left;
      my = e.clientY - b.top;
    };
    const leave = () => ((mx = -1e4), (my = -1e4));
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerleave", leave);

    // one read: pick the group around a bearing, pull it together, wire it, stamp the word
    const CYCLE = 6.4;
    let coinI = -1, coin = COINS[0], gx = 0, gy = 0, group: Blip[] = [], startT = 0, word = "", scr = 0;
    const next = (t: number) => {
      coinI = (coinI + 1) % COINS.length;
      coin = COINS[coinI];
      startT = t;
      const a = rnd() * Math.PI * 2, r = 0.45 + rnd() * 0.3;
      gx = Math.cos(a) * r;
      gy = Math.sin(a) * r;
      blips.forEach((b) => (b.g = -1));
      group = [...blips].sort((p, q) => Math.hypot(p.hx - gx, p.hy - gy) - Math.hypot(q.hx - gx, q.hy - gy)).slice(0, coin.k);
      group.forEach((b, i) => (b.g = i));
    };
    next(0);

    let raf = 0, run = false;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = reduce ? 3.2 : (now - t0) / 1000;
      if (!reduce && t - startT > CYCLE) next(t);
      const ph = reduce ? 3.2 : t - startT; // phase inside the read
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      // the faceplate: rings, cross, bearing ticks
      ctx.strokeStyle = "rgba(242,241,236,0.09)";
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();
      for (let d = 0; d < 360; d += 5) {
        const a = (d * Math.PI) / 180, l = d % 30 === 0 ? 9 : 4;
        ctx.strokeStyle = d % 30 === 0 ? "rgba(242,241,236,0.35)" : "rgba(242,241,236,0.14)";
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
        ctx.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(242,241,236,0.38)";
      ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let d = 0; d < 360; d += 90) {
        const a = ((d - 90) * Math.PI) / 180;
        ctx.fillText(String(d).padStart(3, "0"), cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 20));
      }

      // the beam: a quarter of the disc trailing behind the leading edge, like the mark
      const sweep = (t * 1.25) % (Math.PI * 2) - Math.PI / 2;
      const N = 36, span = Math.PI / 2;
      for (let i = 0; i < N; i++) {
        const a1 = sweep - (span * i) / N, a0 = sweep - (span * (i + 1)) / N;
        ctx.fillStyle = `rgba(242,241,236,${0.13 * Math.pow(1 - i / N, 2.2)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(242,241,236,0.75)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.stroke();

      // the group gathers (0.6 s to 1.8 s into the read)
      const pull = Math.min(1, Math.max(0, (ph - 0.6) / 1.2));
      const e = pull < 0.5 ? 4 * pull ** 3 : 1 - (-2 * pull + 2) ** 3 / 2;
      let near: Blip | null = null, nd = 22;
      for (const b of blips) {
        let tx = b.hx, ty = b.hy;
        if (b.g >= 0) {
          const ga = (b.g / Math.max(1, coin.k)) * Math.PI * 2 + t * 0.4;
          const gr = 0.045 + 0.012 * coin.k;
          tx = b.hx + (gx + Math.cos(ga) * gr - b.hx) * e;
          ty = b.hy + (gy + Math.sin(ga) * gr - b.hy) * e;
        }
        // the reticle pushes blips aside a little
        let px = cx + tx * R, py = cy + ty * R;
        const dx = px - mx, dy = py - my, dd = Math.hypot(dx, dy);
        if (dd < 60 && dd > 0.1 && b.g < 0) {
          const k = (1 - dd / 60) * 10;
          px += (dx / dd) * k;
          py += (dy / dd) * k;
        }
        b.x = px;
        b.y = py;
        if (dd < nd) ((nd = dd), (near = b));
        // lit when the beam has just passed its bearing
        const ba = Math.atan2(py - cy, px - cx);
        let diff = sweep - ba;
        diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.06) b.lit = t;
      }
      const col = tone(coin.word);
      // wires inside the group, drawn once it has gathered
      if (group.length > 1 && ph > 1.4) {
        const k = Math.min(1, (ph - 1.4) / 0.6);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (let i = 0; i < group.length; i++) {
          const a = group[i], b = group[(i + 1) % group.length];
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (const b of blips) {
        const glow = Math.exp(-(t - b.lit) / 1.5);
        const inG = b.g >= 0 && ph > 0.6;
        const a = inG ? 1 : 0.16 + glow * 0.84;
        ctx.fillStyle = inG ? col : `rgba(242,241,236,${a})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, inG ? 2.6 : 1.3 + glow * 0.9, 0, Math.PI * 2);
        ctx.fill();
        if (inG || glow > 0.4) {
          ctx.fillStyle = inG ? col : "rgba(242,241,236,1)";
          ctx.globalAlpha = (inG ? 0.22 : glow * 0.18);
          ctx.beginPath();
          ctx.arc(b.x, b.y, inG ? 9 : 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // the callout: a leader from the group to the edge, with the finding
      if (ph > 1.9 && group.length) {
        const k = Math.min(1, (ph - 1.9) / 0.4);
        const ax = cx + gx * R, ay = cy + gy * R;
        const right = gx >= 0;
        const ex = right ? Math.min(W - 8, ax + 70) : Math.max(8, ax - 70), ey = ay - 34;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (ex - ax) * k, ay + (ey - ay) * k);
        ctx.stroke();
        if (k === 1) {
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
          const full = ctx.measureText(coin.why).width;
          const shown = Math.floor(Math.min(1, (ph - 2.3) / 0.5) * coin.why.length);
          const lx = Math.min(W - 6 - full, Math.max(6, right ? ex - 8 : ex - full + 8));
          ctx.fillStyle = col;
          ctx.fillText(coin.why.slice(0, Math.max(0, shown)), lx, ey - 4);
        }
      }

      // the centre: the dot, the coin, then the word (letters settle out of noise)
      ctx.fillStyle = C.fg;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "rgba(242,241,236,0.62)";
      ctx.fillText(ph < 3 ? `${coin.sym} · reading` : coin.sym, cx, cy + 22);
      if (ph > 3) {
        if (word !== coin.word) ((word = coin.word), (scr = ph));
        const k = Math.min(1, (ph - scr) / 0.45);
        const L = word.length, fixed = Math.floor(k * L);
        const glyphs = "#%&*+=?@ABCDEFGHJKLMNPRSTUVXYZ";
        const out = word.split("").map((ch, i) => (i < fixed ? ch : glyphs[Math.floor(((t * 30 + i * 7) % glyphs.length))])).join("");
        ctx.font = `700 ${Math.round(R * 0.2)}px ${css.getPropertyValue("--sans") || "system-ui"}`;
        ctx.fillStyle = col;
        ctx.fillText(out, cx, cy - R * 0.12);
      } else word = "";

      // the reticle
      if (mx > -1e3) {
        ctx.strokeStyle = "rgba(242,241,236,0.55)";
        ctx.beginPath();
        ctx.moveTo(mx - 10, my);
        ctx.lineTo(mx - 4, my);
        ctx.moveTo(mx + 4, my);
        ctx.lineTo(mx + 10, my);
        ctx.moveTo(mx, my - 10);
        ctx.lineTo(mx, my - 4);
        ctx.moveTo(mx, my + 4);
        ctx.lineTo(mx, my + 10);
        ctx.stroke();
        const n = near as Blip | null;
        if (n) {
          ctx.strokeStyle = C.fg;
          ctx.strokeRect(n.x - 6, n.y - 6, 12, 12);
          ctx.textAlign = mx > W - 150 ? "right" : "left";
          ctx.textBaseline = "top";
          ctx.font = "500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.fillStyle = C.fg;
          const ox = mx > W - 150 ? -12 : 12;
          ctx.fillText(n.id, mx + ox, my + 10);
          ctx.fillStyle = "rgba(242,241,236,0.55)";
          ctx.fillText(`bought ${n.sol} SOL${n.g >= 0 && ph > 0.6 ? " · in the group" : ""}`, mx + ox, my + 24);
        }
      }
      if (run && !reduce) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([en]) => {
      const vis = en.isIntersecting && !document.hidden;
      if (vis && !run) {
        run = true;
        if (reduce) draw(performance.now());
        else raf = requestAnimationFrame(draw);
      } else if (!vis) {
        run = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(cv);
    const vis = () => {
      if (document.hidden) {
        run = false;
        cancelAnimationFrame(raf);
      } else io.takeRecords(), io.unobserve(cv), io.observe(cv);
    };
    document.addEventListener("visibilitychange", vis);
    if (reduce) {
      run = true;
      draw(performance.now());
      const redraw = () => draw(performance.now());
      cv.addEventListener("pointermove", redraw);
    }
    return () => {
      run = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div className="x-scope">
      <canvas ref={ref} aria-label="yeppo's radar reading an example coin: the wallets that bought together are grouped and the coin gets one word" role="img" />
      <span className="x-scope-tag">example read</span>
    </div>
  );
}
