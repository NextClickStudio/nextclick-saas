"use client";

// The home is one film, rendered offline in Blender (Cycles) and scrubbed by scroll: a chrome yeppo coin; the rain of
// the week's launches; a dark glass scanner ring where the rugs turn red and are flung out; the coin taken apart into
// its plate, its rim and the disc of its 24 checks; the coin closed again under a green light; four objects on a dark
// floor that lead further. No headlines: small technical tags ride the objects. Their positions come from the render
// itself (anchors.json: for each frame, where each tagged point lands in the picture), so they stay glued to them.
// Frames load coarse to fine (every 12th first), and the nearest loaded frame is drawn while the rest arrive.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CHECKS } from "@/lib/checks";

const NF = 180;
type Tag = { id: string; n?: string; t: string; v?: string; href?: string; tone?: "red" | "green" | "warn" | "ok"; side?: "l" | "r"; dir?: "u" | "d"; mini?: boolean };
const MINI = [0, 3, 8, 11, 13, 17];
const TAGS: Tag[] = [
  { id: "hero_l", n: "00", t: "yeppo", v: "rug checks · pump.fun", side: "l" },
  { id: "hero_r", t: "Add to Chrome", v: "read a coin ↗", href: "/extension", side: "r", dir: "d" },
  { id: "coin", n: "01", t: "Launches · 7d", v: "164,673" },
  { id: "ring", n: "02", t: "Scanner", v: "open record ↗", href: "/record" },
  { id: "rug", t: "Rug", v: "991 · 7d", tone: "red" },
  { id: "checks", n: "03", t: "24 checks", v: "one coin", side: "r" },
  ...MINI.map((ci, k) => ({ id: `ck${k}`, t: CHECKS[ci][0], v: CHECKS[ci][1], tone: CHECKS[ci][3], mini: true }) as Tag),
  { id: "safe", n: "04", t: "Safe", v: "≈ 1 s", tone: "green", side: "r" },
  { id: "door0", n: "05", t: "Extension", v: "read a coin ↗", href: "/extension", dir: "u" },
  { id: "door1", n: "06", t: "Radar", v: "wallets, live ↗", href: "/radar", dir: "u" },
  { id: "door2", n: "07", t: "Record", v: "every call ↗", href: "/record", dir: "u" },
  { id: "door3", n: "08", t: "Pricing", v: "0.2 sol · 30d ↗", href: "/pricing", dir: "u" },
];
// the objects themselves are links too: [anchor, page, from frame, to frame, radius as a share of the picture]
const HOTS: [string, string, number, number, number][] = [
  ["hero", "/extension", 0, 30, 0.3],
  ["door0", "/extension", 172, NF, 0.075],
  ["door1", "/radar", 172, NF, 0.075],
  ["door2", "/record", 172, NF, 0.075],
  ["door3", "/pricing", 172, NF, 0.075],
];
const CHAPTERS = [0, 46, 70, 124, 156, 168];
type Anchors = Record<string, Record<string, [number, number]>>;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export default function ScrollFilm() {
  const wrap = useRef<HTMLElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const tagEls = useRef<(HTMLElement | null)[]>([]);
  const hotEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = wrap.current, c = cvs.current;
    if (!box || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const small = innerWidth < 760;
    const dir = small ? "m" : "d";
    const imgs: (HTMLImageElement | null)[] = Array(NF).fill(null);
    let alive = true;
    let anchors: Anchors = {};
    const span: Record<string, [number, number]> = {};
    fetch("/film/anchors.json")
      .then((r) => r.json())
      .then((a: Anchors) => {
        anchors = a;
        for (const [f, pts] of Object.entries(a))
          for (const id of Object.keys(pts)) {
            const s = span[id] ?? [1e9, -1];
            span[id] = [Math.min(s[0], +f), Math.max(s[1], +f)];
          }
      })
      .catch(() => {});
    // coarse to fine
    const order: number[] = [];
    for (const st of [12, 4, 1]) for (let f = 0; f < NF; f += st) if (!order.includes(f)) order.push(f);
    if (!order.includes(NF - 1)) order.splice(1, 0, NF - 1);
    let next = 0;
    const load = () => {
      if (!alive || next >= order.length) return;
      const f = order[next++];
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        imgs[f] = im;
        if (f === 0) setReady(true);
        load();
      };
      im.onerror = load;
      im.src = `/film/${dir}/f${String(f).padStart(3, "0")}.webp`;
    };
    for (let k = 0; k < 4; k++) load();

    const nearest = (f: number) => {
      for (let d = 0; d < NF; d++) {
        if (imgs[f - d]) return f - d;
        if (imgs[f + d]) return f + d;
      }
      return -1;
    };
    const progress = () => {
      const r = box.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    };
    let cur = progress() * (NF - 1), raf = 0, last = performance.now(), shownF = -1, drawn = -2, W = 0, H = 0, dpr = 1;
    // where the square picture sits: full height on a wide screen, a little wider than the screen on a phone
    let ix = 0, iy = 0, is = 0;
    const fit = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      is = W / H > 1 ? H : Math.min(H * 0.86, W * 1.04);
      ix = (W - is) / 2;
      iy = W / H > 1 ? 0 : (H - is) / 2 - H * 0.04;
      drawn = -2;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();

    const at = (id: string, f: number): [number, number] | null => {
      const a = Math.floor(f), b = Math.ceil(f), A = anchors[a]?.[id], B = anchors[b]?.[id];
      if (A && B) return [A[0] + (B[0] - A[0]) * (f - a), A[1] + (B[1] - A[1]) * (f - a)];
      return A ?? B ?? null;
    };
    const fade = (id: string, f: number) => {
      const s = span[id];
      if (!s) return 0;
      return clamp(Math.min(s[0] === 0 ? 1 : (f - s[0]) / 3, s[1] === NF - 1 ? 1 : (s[1] - f) / 3, 1));
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cur += (progress() * (NF - 1) - cur) * Math.min(1, dt * 6);
      const f = clamp(cur, 0, NF - 1);
      const fi = Math.round(f);
      if (fi !== shownF) {
        shownF = fi;
        setFrame(fi);
      }
      const n = nearest(fi);
      if (n >= 0 && n !== drawn) {
        drawn = n;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(imgs[n]!, ix, iy, is, is);
        // fade the picture's edges into the black around it
        const e = Math.min(120, is * 0.12);
        const gl = ctx.createLinearGradient(ix, 0, ix + e, 0);
        gl.addColorStop(0, "#000");
        gl.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gl;
        ctx.fillRect(ix - 1, iy, e + 1, is);
        const gr = ctx.createLinearGradient(ix + is, 0, ix + is - e, 0);
        gr.addColorStop(0, "#000");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(ix + is - e, iy, e + 1, is);
        if (iy > 0) {
          const gt = ctx.createLinearGradient(0, iy, 0, iy + e);
          gt.addColorStop(0, "#000");
          gt.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gt;
          ctx.fillRect(ix, iy - 1, is, e + 1);
          const gb = ctx.createLinearGradient(0, iy + is, 0, iy + is - e);
          gb.addColorStop(0, "#000");
          gb.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gb;
          ctx.fillRect(ix, iy + is - e, is, e + 1);
        }
      }
      // tags ride their points
      TAGS.forEach((g, i) => {
        const node = tagEls.current[i];
        if (!node) return;
        const pt = at(g.id, f);
        const k = pt && !(small && g.mini) ? fade(g.id, f) : 0;
        node.style.opacity = k.toFixed(3);
        node.style.visibility = k > 0.01 ? "visible" : "hidden";
        if (!pt) return;
        const x = ix + pt[0] * is, y = iy + pt[1] * is;
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        // on a phone the coin fills the width: its two tags go above and below it, toward the middle
        const side = small && g.id === "hero_l" ? "r" : small && g.id === "hero_r" ? "l" : g.side;
        node.dataset.side = side ?? (x > W * (small ? 0.5 : 0.6) ? "l" : "r");
        node.dataset.dir = g.dir ?? "";
      });
      HOTS.forEach(([id, , a, b, rad], i) => {
        const node = hotEls.current[i];
        if (!node) return;
        const on = f >= a && f <= b;
        let x = ix + is / 2, y = iy + is / 2;
        if (id !== "hero") {
          const pt = at(id, f);
          if (!pt) return void (node.style.display = "none");
          x = ix + pt[0] * is;
          y = iy + pt[1] * is + is * 0.11; // the object stands under its tag
        }
        const r = rad * is;
        node.style.display = on ? "block" : "none";
        node.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
        node.style.width = node.style.height = `${(2 * r).toFixed(0)}px`;
      });
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(box);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  let chap = 0;
  CHAPTERS.forEach((c, i) => frame >= c && (chap = i));
  return (
    <section ref={wrap} className="w3 on film">
      <h1 className="w3-sr">yeppo: rug checks for pump.fun coins, in the browser</h1>
      <div className="w3-stage">
        {/* the first frame as a plain picture until the canvas has it */}
        {!ready && <img className="w3-poster" src="/film/d/f000.webp" alt="" />}
        <canvas ref={cvs} className="w3-canvas" />
        {TAGS.map((g, i) => {
          const body = (
            <>
              <i className="w3-dot" />
              <i className="w3-lead" />
              <span className="w3-box">
                {g.n && <em>{g.n}</em>}
                <b>{g.t}</b>
                {g.v && <span>{g.v}</span>}
              </span>
            </>
          );
          const cls = `w3-tag ${g.tone ?? ""} ${g.mini ? "mini" : ""} ${g.href ? "go" : ""}`;
          return g.href ? (
            <Link key={g.id} href={g.href} className={cls} ref={(n) => void (tagEls.current[i] = n)}>
              {body}
            </Link>
          ) : (
            <span key={g.id} className={cls} ref={(n) => void (tagEls.current[i] = n)} aria-hidden>
              {body}
            </span>
          );
        })}
        {HOTS.map(([id, href], i) => (
          <Link key={id} href={href} className="w3-hot" ref={(n) => void (hotEls.current[i] = n)} aria-hidden tabIndex={-1} />
        ))}
        <div className="w3-hud" aria-hidden>
          <span>{String(chap).padStart(2, "0")} / 05</span>
          <b className="w3-bar">
            <i style={{ transform: `scaleX(${(frame / (NF - 1)).toFixed(3)})` }} />
          </b>
          <span>{frame < 6 ? "scroll" : frame > 172 ? "pick an object" : "yeppo.it"}</span>
        </div>
      </div>
    </section>
  );
}
