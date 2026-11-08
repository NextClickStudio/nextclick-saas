"use client";

// The home: a film rendered offline in Blender and played in the browser. First the intro plays on its own (the
// lighthouse rises out of a night storm, segment by segment, and its lamp comes on); then scroll takes over and drives
// the camera down the tower, under the waves and into the deep, where the sea's dangers stand for the rugs (mines,
// jellyfish), a school of fish for the wallets that move together, a wreck for the record, a beacon for the key.
// No header, no buttons: the objects are the links, with small tags that ride them (their positions come from the
// render, frame by frame). Frames load coarse to fine; the nearest loaded frame is drawn while the rest arrive.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const NI = 60, NS = 120, FPS = 22;
type Tag = { id: string; n?: string; t: string; v?: string; href?: string; tone?: "red" | "green" };
const TAGS: Tag[] = [
  { id: "tower", n: "01", t: "yeppo", v: "the light on every coin ↗", href: "/extension" },
  { id: "mine0", t: "Rug", v: "danger · 991 this week", tone: "red" },
  { id: "mine1", t: "Bundle", v: "hidden wallets", tone: "red" },
  { id: "mine2", t: "Dev dump", v: "sold in seconds", tone: "red" },
  { id: "school", n: "02", t: "Radar", v: "wallets moving together ↗", href: "/radar" },
  { id: "wreck", n: "03", t: "Record", v: "every call, kept ↗", href: "/record" },
  { id: "beacon", n: "04", t: "Key", v: "0.2 sol · 30 days ↗", href: "/pricing" },
];
// the objects are links too: [anchor, page, radius as a share of the frame height]
const HOTS: [string, string, number][] = [
  ["tower", "/extension", 0.22],
  ["school", "/radar", 0.12],
  ["wreck", "/record", 0.16],
  ["beacon", "/pricing", 0.12],
];
type Anchors = Record<string, Record<string, [number, number]>>;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const pad = (n: number) => String(n).padStart(3, "0");

export default function Lighthouse() {
  const wrap = useRef<HTMLElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const tagEls = useRef<(HTMLElement | null)[]>([]);
  const hotEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [phase, setPhase] = useState<"load" | "intro" | "live">("load");
  const [loaded, setLoaded] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const box = wrap.current, c = cvs.current;
    if (!box || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let alive = true;
    const intro: (HTMLImageElement | null)[] = Array(NI).fill(null);
    const scroll: (HTMLImageElement | null)[] = Array(NS).fill(null);
    let anchors: Anchors = {};
    const span: Record<string, [number, number]> = {};
    fetch("/film2/anchors.json")
      .then((r) => r.json())
      .then((a: Anchors) => {
        anchors = a;
        for (const [key, pts] of Object.entries(a)) {
          const f = +key.slice(1);
          for (const id of Object.keys(pts)) {
            const s = span[id] ?? [1e9, -1];
            span[id] = [Math.min(s[0], f), Math.max(s[1], f)];
          }
        }
      })
      .catch(() => {});

    // the intro first, whole; then the scroll frames coarse to fine
    const queue: [("i" | "s"), number][] = [];
    for (let f = 0; f < NI; f++) queue.push(["i", f]);
    const seen = new Set<number>();
    for (const st of [12, 4, 1]) for (let f = 0; f < NS; f += st) if (!seen.has(f)) (seen.add(f), queue.push(["s", f]));
    let next = 0, introDone = 0;
    const load = () => {
      if (!alive || next >= queue.length) return;
      const [kind, f] = queue[next++];
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        (kind === "i" ? intro : scroll)[f] = im;
        if (kind === "i") setLoaded(++introDone);
        load();
      };
      im.onerror = load;
      im.src = `/film2/${kind}${pad(f)}.webp`;
    };
    for (let k = 0; k < 6; k++) load();

    let W = 0, H = 0, dpr = 1, ix = 0, iy = 0, iw = 0, ih = 0;
    const fit = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      // cover: the picture fills the screen, centred
      const s = Math.max(W / 16, H / 9);
      iw = 16 * s;
      ih = 9 * s;
      ix = (W - iw) / 2;
      iy = (H - ih) / 2;
      drawn = null;
    };
    let drawn: HTMLImageElement | null = null;
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();
    const draw = (im: HTMLImageElement | null) => {
      if (!im || im === drawn) return;
      drawn = im;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(im, ix, iy, iw, ih);
    };
    const nearest = (arr: (HTMLImageElement | null)[], f: number) => {
      for (let d = 0; d < arr.length; d++) {
        if (arr[f - d]) return arr[f - d];
        if (arr[f + d]) return arr[f + d];
      }
      return null;
    };
    const progress = () => {
      const r = box.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    };
    const at = (id: string, f: number): [number, number] | null => {
      const a = Math.floor(f), b = Math.ceil(f), A = anchors[`s${a}`]?.[id], B = anchors[`s${b}`]?.[id];
      if (A && B) return [A[0] + (B[0] - A[0]) * (f - a), A[1] + (B[1] - A[1]) * (f - a)];
      return A ?? B ?? null;
    };

    // phases: wait for the intro frames, play them once, then hand over to scroll
    document.documentElement.style.overflow = "hidden";
    scrollTo(0, 0);
    let ph: "load" | "intro" | "live" = "load", t0 = 0, cur = 0, raf = 0, last = performance.now(), shown = -1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (ph === "load") {
        draw(intro[0]);
        if (introDone >= NI - 2) {
          ph = "intro";
          t0 = now;
          setPhase("intro");
        }
      } else if (ph === "intro") {
        const f = Math.min(NI - 1, Math.floor(((now - t0) / 1000) * FPS));
        draw(nearest(intro, f));
        if (f >= NI - 1) {
          ph = "live";
          setPhase("live");
          document.documentElement.style.overflow = "";
        }
      } else {
        cur += (progress() * (NS - 1) - cur) * Math.min(1, dt * 6);
        const f = clamp(cur, 0, NS - 1);
        const fi = Math.round(f);
        if (fi !== shown) {
          shown = fi;
          setFrame(fi);
        }
        draw(nearest(scroll, fi));
        TAGS.forEach((g, i) => {
          const node = tagEls.current[i];
          if (!node) return;
          const pt = at(g.id, f), s = span[g.id];
          const k = pt && s ? clamp(Math.min(s[0] === 0 ? 1 : (f - s[0]) / 3, s[1] === NS - 1 ? 1 : (s[1] - f) / 3, 1)) : 0;
          node.style.opacity = k.toFixed(3);
          node.style.visibility = k > 0.01 ? "visible" : "hidden";
          if (!pt) return;
          const x = ix + pt[0] * iw, y = iy + pt[1] * ih;
          node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          node.dataset.side = x > W * 0.6 ? "l" : "r";
        });
        HOTS.forEach(([id, , rad], i) => {
          const node = hotEls.current[i];
          if (!node) return;
          const pt = at(id, f);
          if (!pt) return void (node.style.display = "none");
          const x = ix + pt[0] * iw, y = iy + pt[1] * ih + (id === "tower" ? ih * 0.2 : ih * 0.08), r = rad * ih;
          node.style.display = "block";
          node.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
          node.style.width = node.style.height = `${(2 * r).toFixed(0)}px`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.documentElement.style.overflow = "";
    };
  }, []);

  const depth = Math.round((frame / (NS - 1)) * 42);
  return (
    <section ref={wrap} className="lh">
      <h1 className="w3-sr">yeppo: rug checks for pump.fun coins, in the browser</h1>
      <div className="lh-stage">
        <canvas ref={cvs} className="lh-canvas" />
        {phase === "load" && (
          <div className="lh-load" aria-hidden>
            <span>{pad(Math.round((loaded / NI) * 100))}</span>
            <i style={{ transform: `scaleX(${(loaded / NI).toFixed(3)})` }} />
          </div>
        )}
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
          const cls = `w3-tag ${g.tone ?? ""} ${g.href ? "go" : ""}`;
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
          <Link key={id} href={href} className="w3-hot" ref={(n) => void (hotEls.current[i] = n)} aria-label={id} tabIndex={-1} />
        ))}
        <div className={`lh-hud ${phase === "live" ? "on" : ""}`} aria-hidden>
          <span className="lh-mark">yeppo</span>
          <span className="lh-k">rug checks · pump.fun</span>
          <span className="lh-depth">{phase === "live" ? `depth ${String(depth).padStart(2, "0")} m` : "lighting up"}</span>
          <span className="lh-hint">{frame < 4 ? "scroll ↓" : frame > 112 ? "pick an object" : ""}</span>
        </div>
      </div>
    </section>
  );
}
