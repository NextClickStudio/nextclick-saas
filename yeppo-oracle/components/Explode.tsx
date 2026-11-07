"use client";

// One read, taken apart. Scroll drives it: a coin card sits in the middle with its checks folded into lines; the card's
// frame opens to the whole stage and the 24 checks fly out to their places, tilted in depth; a scan line reads them
// one row at a time; then every check falls back into the middle and the frame closes round one word.
// Example coin; the checks are the real list yeppo reads.
import { useEffect, useRef } from "react";
import { CHECKS } from "@/lib/checks";

export default function Explode() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const stage = box.querySelector<HTMLElement>(".xe-stage")!;
    const frame = box.querySelector<HTMLElement>(".xe-frame")!;
    const head = box.querySelector<HTMLElement>(".xe-head")!;
    const word = box.querySelector<HTMLElement>(".xe-word")!;
    const scan = box.querySelector<HTMLElement>(".xe-scan")!;
    const steps = [...box.querySelectorAll<HTMLElement>(".xe-step")];
    const bar = box.querySelector<HTMLElement>(".xe-bar i")!;
    const cells = [...box.querySelectorAll<HTMLElement>(".xe-cell")];
    const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let G = { W: 0, H: 0, cols: 6, cw: 0, ch: 0, gx: 0, gy: 0, gap: 6, card: { x: 0, y: 0, w: 0, h: 0 }, rowH: 15, as: 1, clipH: 27, fp: { x: 0, y: 0, w: 0, bw: 0, bh: 0, gap: 0 } };
    const layout = () => {
      const W = stage.clientWidth, H = stage.clientHeight;
      const cols = W >= 1080 ? 6 : W >= 700 ? 4 : 3;
      const rows = Math.ceil(cells.length / cols);
      const side = Math.max(16, W * 0.04), gap = W < 700 ? 4 : 6;
      // under whatever header the page has (the paper masthead is taller than the old one)
      const mast = (document.querySelector(".p-mast, .nav") as HTMLElement | null)?.getBoundingClientRect().height ?? 70;
      const rail = box.querySelector<HTMLElement>(".xe-rail");
      if (rail) rail.style.top = `${mast + 14}px`;
      const top = mast + (W < 700 ? 56 : 66), bottom = 48;
      const cw = (W - 2 * side - (cols - 1) * gap) / cols;
      const ch = Math.min(W < 700 ? 66 : 96, (H - top - bottom - (rows - 1) * gap) / rows);
      const gy = top + Math.max(0, (H - top - bottom - (rows * ch + (rows - 1) * gap)) / 2);
      const cardW = Math.min(440, W - 2 * side);
      // folded, each check shows only its first line: the clip height in the cell's own pixels, then the row it takes
      const as = Math.min(1, (cardW - 40) / 2 / cw), clipH = W < 700 ? 19 : 27, rowH = clipH * as + 2;
      const cardH = 60 + Math.ceil(cells.length / 2) * rowH + 14;
      // the coin's fingerprint: one thin bar per check, in a row under the word
      const fpW = Math.min(W - 2 * side, 760), fgap = W < 700 ? 3 : 6;
      const bw = (fpW - (cells.length - 1) * fgap) / cells.length, bh = W < 700 ? 44 : 64;
      const fp = { x: (W - fpW) / 2, y: H / 2 + (W < 700 ? 24 : 36), w: fpW, bw, bh, gap: fgap };
      G = { W, H, cols, cw, ch, gx: side, gy, gap, card: { x: (W - cardW) / 2, y: Math.max(top, (H - cardH) / 2), w: cardW, h: cardH }, rowH, as, clipH, fp };
      cells.forEach((c) => {
        c.style.width = cw + "px";
        c.style.height = ch + "px";
      });
      render();
    };
    const progress = () => {
      const r = box.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - stage.clientHeight));
      if (!reduce) return p;
      return p < 0.25 ? 0 : p < 0.8 ? 0.6 : 1;
    };
    const render = () => {
      const p = progress();
      const { cw, ch, gx, gy, gap, cols, card, rowH, W, H, as, clipH, fp } = G;
      const open = ease(clamp((p - 0.08) / 0.26)); // card → grid
      const close = ease(clamp((p - 0.74) / 0.18)); // grid → word
      const gridW = cols * cw + (cols - 1) * gap, gridH = Math.ceil(cells.length / cols) * (ch + gap) - gap;
      // the frame: the card's border opens to the grid, then closes into the rule under the fingerprint
      const f0 = card, f1 = { x: gx - 10, y: gy - 10, w: gridW + 20, h: gridH + 20 }, f2 = { x: fp.x, y: fp.y + fp.bh + 14, w: fp.w, h: 1 };
      const fx = close > 0 ? lerp(f1.x, f2.x, close) : lerp(f0.x, f1.x, open);
      const fy = close > 0 ? lerp(f1.y, f2.y, close) : lerp(f0.y, f1.y, open);
      const fw = close > 0 ? lerp(f1.w, f2.w, close) : lerp(f0.w, f1.w, open);
      const fh = close > 0 ? lerp(f1.h, f2.h, close) : lerp(f0.h, f1.h, open);
      frame.style.transform = `translate(${fx}px, ${fy}px)`;
      frame.style.width = fw + "px";
      frame.style.height = fh + "px";
      head.style.transform = `translate(${lerp(card.x + 16, f1.x, open)}px, ${lerp(card.y + 16, f1.y - 30, open) - close * 2 * H}px)`;
      // the scan line runs down the grid between 0.42 and 0.68
      const sp = clamp((p - 0.42) / 0.26);
      scan.style.transform = `translate(${gx - 10}px, ${gy + sp * gridH}px)`;
      scan.style.width = gridW + 20 + "px";
      scan.style.opacity = sp > 0 && sp < 1 ? "1" : "0";
      const scanned = sp * gridH + gy;
      cells.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const lc = i % 2, lr = Math.floor(i / 2);
        // folded inside the card: two columns of one-line rows
        const ax = card.x + 16 + lc * ((card.w - 24) / 2), ay = card.y + 56 + lr * rowH;
        const bx = gx + col * (cw + gap), by = gy + row * (ch + gap);
        const k = ease(clamp((p - 0.08 - i * 0.006) / 0.22));
        const kc = ease(clamp((p - 0.74 - (cells.length - i) * 0.003) / 0.14));
        let x = lerp(ax, bx, k), y = lerp(ay, by, k), s = lerp(as, 1, k);
        // in depth while flying: tilt one way out, the other way in
        const tilt = Math.sin(k * Math.PI) * (col - (cols - 1) / 2) * 9;
        const tx = Math.sin(k * Math.PI) * (row - 2) * -7;
        // then every card narrows into its bar of the fingerprint, in reading order
        x = lerp(x, fp.x + i * (fp.bw + fp.gap), kc);
        y = lerp(y, fp.y, kc);
        const sx = lerp(s, fp.bw / cw, kc), sy = lerp(s, fp.bh / ch, kc);
        // laid out like index cards on a desk: each one a little off square
        const rot = (((i * 37) % 7) - 3) * 0.55 * k * (1 - kc);
        c.style.transform = `translate3d(${x}px, ${y}px, 0) rotateY(${tilt * (1 - kc)}deg) rotateX(${tx * (1 - kc)}deg) rotate(${rot}deg) scale(${sx}, ${sy})`;
        c.style.clipPath = `inset(0 0 ${lerp(Math.max(0, ch - clipH), 0, k)}px 0)`;
        c.classList.toggle("on", p > 0.42 && by + ch / 2 < scanned + 1);
        c.classList.toggle("bar", kc > 0.35);
      });
      // the word rises out of its own line above the fingerprint
      const wk = ease(clamp((p - 0.84) / 0.12));
      word.style.transform = `translate(-50%, calc(-100% + ${fp.y - H / 2 - 18}px + ${(1 - wk) * 60}%))`;
      word.style.clipPath = `inset(0 0 ${(1 - wk) * 100}% 0)`;
      const at = p < 0.34 ? 0 : p < 0.72 ? 1 : 2;
      steps.forEach((s, i) => s.classList.toggle("on", i === at));
      bar.style.transform = `scaleX(${p})`;
    };
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    layout();
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    addEventListener("scroll", on, { passive: true });
    return () => {
      ro.disconnect();
      removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section className="xe" ref={root} id="how">
      <div className="xe-stage">
        <div className="xe-rail">
          <span className="p-sec">
            <i>§3</i> One coin, taken apart
          </span>
          <ol>
            {["Open a coin", "24 checks, at once", "One word"].map((s, i) => (
              <li key={s} className="xe-step">
                <i>0{i + 1}</i>
                {s}
              </li>
            ))}
          </ol>
          <span className="xe-bar">
            <i />
          </span>
        </div>
        <div className="xe-frame" />
        <div className="xe-head">
          <b>$SEAL</b>
          <span>example coin · read in 1.1 s</span>
        </div>
        {CHECKS.map(([n, v, src, st]) => (
          <div key={n} className={`xe-cell ${st}`}>
            <span className="xe-n">
              <i />
              {n}
            </span>
            <b>{v}</b>
            <small>{src}</small>
          </div>
        ))}
        <div className="xe-scan" />
        <div className="xe-word">
          <span className="xe-cap">24 checks · 22 clean · 2 to watch</span>
          <b className="t-safe">Safe</b>
        </div>
      </div>
    </section>
  );
}
