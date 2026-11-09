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
  { id: "rock", n: "01", t: "yeppo", v: "the light on every coin ↗", href: "/extension" },
  { id: "mine0", t: "Rug", v: "danger · 991 this week", tone: "red" },
  { id: "mine1", t: "Bundle", v: "hidden wallets", tone: "red" },
  { id: "mine2", t: "Dev dump", v: "sold in seconds", tone: "red" },
  { id: "school", n: "02", t: "Radar", v: "wallets moving together ↗", href: "/radar" },
  { id: "wreck", n: "03", t: "Record", v: "every call, kept ↗", href: "/record" },
  { id: "beacon", n: "04", t: "Key", v: "0.2 sol · 30 days ↗", href: "/pricing" },
];
// the objects are links too: [anchor, page, radius as a share of the frame height]
const HOTS: [string, string, number][] = [
  ["rock", "/extension", 0.24],
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
  const cursor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"load" | "intro" | "live">("load");
  const [loaded, setLoaded] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const box = wrap.current, c = cvs.current;
    if (!box || !c) return;
    // the picture goes through a small shader: a drift that follows the mouse, ripples around the cursor under water,
    // a glow on the object under the pointer, a little colour fringe and grain. Without WebGL, a plain 2D draw.
    const gl = c.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    const ctx = gl ? null : c.getContext("2d");
    if (!gl && !ctx) return;
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

    let W = 0, H = 0, dpr = 1, ix = 0, iy = 0, iw = 0, ih = 0, lastKey = "";
    const fit = () => {
      dpr = 1; // the frames are smaller than the screen anyway: drawing at 2x only costs time
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
      panX = ix;
      drawn = null;
      lastKey = "";
    };
    let drawn: HTMLImageElement | null = null, panX = 0;
    // on a narrow screen the picture is wider than the screen: at the end it pans from one object to the next
    const pan = (f: number) => {
      if (W >= H) return;
      const cx = f < 96 ? 0.5 : 0.27 + 0.46 * clamp((f - 98) / 19);
      const want = Math.min(0, Math.max(W - iw, W / 2 - cx * iw));
      panX += (want - panX) * 0.12;
      ix = panX;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();
    // mouse, eased; hover glow, eased
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, px: -1, py: -1, inside: 0 };
    const glow = { x: 0.5, y: 0.5, k: 0 };
    let under = 0, hoverId: string | null = null;
    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / Math.max(1, W);
      mouse.ty = e.clientY / Math.max(1, H);
      mouse.px = e.clientX;
      mouse.py = e.clientY;
      mouse.inside = 1;
    };
    const onLeave = () => void (mouse.inside = 0);
    addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    let prog: WebGLProgram | null = null, texture: WebGLTexture | null = null;
    const U: Record<string, WebGLUniformLocation | null> = {};
    if (gl) {
      const sh = (type: number, src: string) => {
        const o = gl.createShader(type)!;
        gl.shaderSource(o, src);
        gl.compileShader(o);
        return o;
      };
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }"));
      gl.attachShader(
        prog,
        sh(
          gl.FRAGMENT_SHADER,
          [
            "precision highp float;",
            "varying vec2 v; uniform sampler2D t; uniform vec2 res; uniform vec4 img; uniform vec2 m; uniform vec3 g; uniform float time, under, has;",
            "float h(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }",
            "void main(){",
            "  vec2 px = vec2(v.x, 1.0 - v.y) * res;",
            "  vec2 d = (m - 0.5);",
            "  px += d * res * -0.018;",                                   // drift against the mouse
            "  vec2 c = px / res - m; c.x *= res.x / res.y; float r = length(c);",
            "  float wave = sin(r * 60.0 - time * 3.0) * exp(-r * 9.0) * under * has;",  // ripples round the cursor, under water
            "  px += normalize(c + 1e-5) * wave * 7.0;",
            "  vec2 uv = (px - img.xy) / img.zw; uv = (uv - 0.5) / 1.035 + 0.5;",
            "  float ca = 0.0025 * exp(-r * 6.0) * has * under;",
            "  vec3 col = vec3(texture2D(t, uv + vec2(ca, 0.0)).r, texture2D(t, uv).g, texture2D(t, uv - vec2(ca, 0.0)).b);",
            "  vec2 gc = px / res - g.xy; gc.x *= res.x / res.y;",
            "  col += vec3(0.55, 0.8, 1.0) * g.z * (0.22 * exp(-length(gc) * 7.0) + 0.06 * sin(time * 4.0) * exp(-length(gc) * 12.0));",
            "  vec2 vg = v - 0.5; col *= 1.0 - dot(vg, vg) * 0.9;",
            "  gl_FragColor = vec4(col, 1.0);",
            "}",
          ].join("\n"),
        ),
      );
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["t", "res", "img", "m", "g", "time", "under", "has"]) U[n] = gl.getUniformLocation(prog, n);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
        gl.texParameteri(gl.TEXTURE_2D, k, val);
    }
    // redraw only when something on screen changes; the ripples under the cursor are the one thing that moves alone
    const draw = (im: HTMLImageElement | null, now = performance.now()) => {
      if (!im) return;
      const animating = under && mouse.inside;
      const key = `${im.src}|${ix.toFixed(1)}|${iy.toFixed(1)}|${W}|${H}|${mouse.x.toFixed(4)}|${mouse.y.toFixed(4)}|${glow.k.toFixed(3)}|${glow.x.toFixed(3)}`;
      if (!animating && key === lastKey) return;
      lastKey = key;
      if (gl && prog) {
        if (im !== drawn) {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
          drawn = im;
        }
        gl.viewport(0, 0, c.width, c.height);
        gl.uniform1i(U.t, 0);
        gl.uniform2f(U.res, W, H);
        gl.uniform4f(U.img, ix, iy, iw, ih);
        gl.uniform2f(U.m, mouse.x, mouse.y);
        gl.uniform3f(U.g, glow.x, glow.y, glow.k);
        gl.uniform1f(U.time, now / 1000);
        gl.uniform1f(U.under, under);
        gl.uniform1f(U.has, mouse.inside);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (ctx && im !== drawn) {
        drawn = im;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(im, ix, iy, iw, ih);
      }
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
      if (A ?? B) return A ?? B ?? null;
      for (let d = 1; d <= 3; d++) {
        const N = anchors[`s${a + d}`]?.[id];
        if (N) return N;
      }
      return null;
    };

    // phases: wait for the intro frames, play them once, then hand over to scroll
    document.documentElement.style.overflow = "hidden";
    scrollTo(0, 0);
    let ph: "load" | "intro" | "live" = "load", t0 = 0, cur = 0, raf = 0, last = performance.now(), shown = -1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ease = Math.min(1, dt * 3);
      mouse.x += (mouse.tx - mouse.x) * ease;
      mouse.y += (mouse.ty - mouse.y) * ease;
      const cur_ = cursor.current;
      if (cur_) {
        cur_.style.transform = `translate3d(${mouse.px.toFixed(1)}px, ${mouse.py.toFixed(1)}px, 0)`;
        cur_.classList.toggle("on", !!hoverId);
        cur_.style.opacity = mouse.inside ? "1" : "0";
      }
      if (ph === "load") {
        draw(intro[0], now);
        if (introDone >= NI - 2) {
          ph = "intro";
          t0 = now;
          setPhase("intro");
        }
      } else if (ph === "intro") {
        const f = Math.min(NI - 1, Math.floor(((now - t0) / 1000) * FPS));
        draw(nearest(intro, f), now);
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
        under = fi >= 56 ? 1 : 0;
        pan(f);
        draw(nearest(scroll, fi), now);
        TAGS.forEach((g, i) => {
          const node = tagEls.current[i];
          if (!node) return;
          const pt = at(g.id, f), s = span[g.id];
          const k = pt && s ? clamp(Math.min(s[0] <= 3 ? 1 : (f - s[0]) / 3, s[1] === NS - 1 ? 1 : (s[1] - f) / 3, 1)) : 0;
          node.style.opacity = k.toFixed(3);
          node.style.visibility = k > 0.01 ? "visible" : "hidden";
          if (!pt) return;
          const x = ix + pt[0] * iw, y = iy + pt[1] * ih;
          node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          node.dataset.side = x > W * 0.6 ? "l" : "r";
        });
        let hit: string | null = null, hx = glow.x, hy = glow.y;
        HOTS.forEach(([id, , rad], i) => {
          const node = hotEls.current[i];
          if (!node) return;
          const pt = at(id, f);
          if (!pt) return void (node.style.display = "none");
          const x = ix + pt[0] * iw, y = iy + pt[1] * ih + (id === "rock" ? -ih * 0.32 : ih * 0.08), r = rad * ih;
          if (Math.hypot(mouse.px - x, mouse.py - y) < r) {
            hit = id;
            hx = x / W;
            hy = y / H;
          }
          node.style.display = "block";
          node.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
          node.style.width = node.style.height = `${(2 * r).toFixed(0)}px`;
        });
        // the object under the pointer: its glow comes up, its tag opens
        if (hit !== hoverId) {
          hoverId = hit;
          TAGS.forEach((g, i) => tagEls.current[i]?.classList.toggle("on", g.id === hit));
        }
        if (hit) {
          glow.x += (hx - glow.x) * 0.3;
          glow.y += (hy - glow.y) * 0.3;
        }
        glow.k += ((hit ? 1 : 0) - glow.k) * Math.min(1, dt * 5);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
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
        <div ref={cursor} className="lh-cursor" aria-hidden />
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
