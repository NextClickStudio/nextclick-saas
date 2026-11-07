"use client";

// The home's opening: one sticky stage driven by scroll. A camera moves across a single world (pan to the checks,
// pull back onto the wallet radar, drop to a post, drop to the week's numbers) and every element either travels out of
// frame or turns into the next one: no fades, no slides. Example data on the stage, real numbers at the end.
import Link from "next/link";
import { useEffect, useRef } from "react";
import Search from "./Search";

const CHECKS: [string, string, boolean][] = [
  ["Launch bundle", "3.1% · 4 wallets", true],
  ["Insiders, real balances", "11.2% · safe zone", true],
  ["Snipers", "2.4%", true],
  ["Linked wallets", "1 group · 4.9%", true],
  ["Same-amount buys", "none", true],
  ["Creator", "2nd coin · no rugs", true],
  ["Creator's funder", "an exchange", true],
  ["Ticker copies", "3 · none ran", false],
  ["X origin", "account 3 years old", true],
];
const ROWS: [string, string, string, string, string][] = [
  ["S", "$SEAL", "2 of your wallets · 4 min", "safe", "Safe"],
  ["B", "$BOOK", "1 of your wallets", "risky", "Risky"],
  ["G", "$GOAT", "bundle 38%", "danger", "Danger"],
];
const BORN: [string, string, string][] = [
  ["$WHALE", "Safe", "safe"],
  ["$OCEAN", "Danger", "danger"],
  ["$BACK", "Risky", "risky"],
];
const SEG = [0.8, 3.1, 2.4, 4.9, 88.8];
const BEATS: [number, string, string][] = [
  [0, "01 Read", "One coin, opened"],
  [0.14, "02 Check", "Nine checks, in order"],
  [0.36, "03 Radar", "Your wallets, live"],
  [0.58, "04 Posts", "A post lands on J7"],
  [0.8, "05 Record", "What it did last week"],
];
// the week of 28 Oct to 4 Nov 2026, from yeppo's own tables (also in the Discord launch post)
const NUMS: [string, number][] = [
  ["coins read in a week", 164673],
  ["bundled launches flagged", 12050],
  ["rugs spotted", 991],
];

export default function CameraStory() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = root.current;
    if (!box) return;
    const $ = <T extends HTMLElement = HTMLElement>(s: string) => box.querySelector(s) as T;
    const $$ = (s: string) => [...box.querySelectorAll<HTMLElement>(s)];
    const stage = $(".cs-stage"), world = $(".cs-world");
    const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    function track(p: number, keys: [number, number][]): number;
    function track(p: number, keys: [number, number[]][]): number[];
    function track(p: number, keys: [number, number | number[]][]): number | number[] {
      if (p <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        const [p1, v1] = keys[i];
        if (p <= p1) {
          const [p0, v0] = keys[i - 1];
          const k = ease((p - p0) / (p1 - p0));
          return Array.isArray(v0) ? v0.map((v, j) => lerp(v, (v1 as number[])[j], k)) : lerp(v0, v1 as number, k);
        }
      }
      return keys[keys.length - 1][1];
    }
    const put = (el: HTMLElement, x: number, y: number, s = 1) => (el.style.transform = `translate(${x}px, ${y}px) scale(${s})`);
    const checks = $$(".cs-check"), radar = $$(".cs-radar .cs-rrow"), chips = $$(".cs-chip"), sig = $(".cs-signal");
    const born = $$(".cs-born .cs-rrow"), wires = $$(".cs-wire"), segs = $$(".cs-bar i"), nums = $$(".cs-num");
    const coin = $(".cs-coin"), hero = $(".cs-hero"), post = $(".cs-post");
    type R = { chkX: number; chkY: number; radY: number; postY: number; numY: number };
    let L: { W: number; H: number; narrow: boolean; g: number; cardW: number; R: R; hero: { x: number; y: number; w: number }; coin: { x: number; y: number } } | null = null;

    function layout() {
      const W = stage.clientWidth, H = stage.clientHeight, narrow = W < 820;
      const g = Math.max(16, W * 0.04);
      const cardW = Math.min(380, W - 2 * g);
      const R: R = narrow ? { chkX: 0, chkY: H, radY: 2 * H, postY: 3 * H, numY: 4 * H } : { chkX: W * 0.42, chkY: 0, radY: H, postY: 2 * H, numY: 3 * H };
      L = { W, H, narrow, g, cardW, R, hero: narrow ? { x: g, y: 84, w: W - 2 * g } : { x: g, y: H * 0.16, w: Math.min(560, W * 0.5) }, coin: narrow ? { x: g, y: H - 300 } : { x: W - g - cardW, y: H * 0.16 } };
      hero.style.width = L.hero.w + "px";
      coin.style.width = cardW + "px";
      checks.forEach((c) => (c.style.width = Math.min(420, W - 2 * g) + "px"));
      [...radar, ...born].forEach((c) => (c.style.width = Math.min(460, W - 2 * g) + "px"));
      post.style.width = Math.min(440, W - 2 * g) + "px";
      render();
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function progress() {
      const r = box!.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - stage.clientHeight));
      if (!reduce) return p;
      // with reduced motion the camera cuts between beats instead of travelling
      let b = 0;
      for (const [bp] of BEATS) if (p >= bp) b = bp;
      return b + 0.001;
    }
    function render() {
      if (!L) return;
      const p = progress();
      const { W, H, narrow, g, cardW, R } = L;
      const camX = track(p, [[0.12, 0], [0.3, -R.chkX], [0.36, -R.chkX], [0.52, 0], [1, 0]]);
      const camY = track(p, [[0.12, 0], [0.3, -R.chkY], [0.36, -R.chkY], [0.52, -R.radY], [0.6, -R.radY], [0.74, -R.postY], [0.82, -R.postY], [0.96, -R.numY]]);
      const zoom = track(p, [[0.36, 1], [0.48, 0.9], [0.56, 1], [1, 1]]);
      world.style.transform = `scale(${zoom}) translate(${camX}px, ${camY}px)`;
      put(hero, L.hero.x, L.hero.y);

      // the card checks, then turns Safe; then it flies into the first radar row and turns into it
      const chk = clamp((p - 0.02) / 0.16);
      segs.forEach((s, i) => (s.style.flex = `${lerp(i === 4 ? 100 : 0.0001, SEG[i], clamp(chk * 1.4 - i * 0.08))}`));
      const safe = chk > 0.98;
      $(".cs-vword").textContent = safe ? "Safe" : "Checking";
      $(".cs-vwhy").textContent = safe ? "nothing wrong found · 9 of 9 checks read" : "reading the launch blocks";
      $(".cs-vdot").style.background = safe ? "var(--up)" : "var(--mute)";
      const rowW = Math.min(460, W - 2 * g);
      const radarX = narrow ? g : (W - rowW) / 2;
      const radarY0 = R.radY + H * 0.2;
      const cp = track(p, [[0.36, [L.coin.x, L.coin.y, 1]], [0.46, [radarX, radarY0 - 4, Math.min(1, rowW / cardW)]]]);
      put(coin, cp[0], cp[1], cp[2]);
      coin.style.clipPath = `inset(0 0 ${track(p, [[0.4, 0], [0.47, 1]]) * 78}% 0 round 22px)`;

      // the checks come in from the right edge, one after the other
      const ckX0 = R.chkX + (narrow ? g : W * 0.6), ckY0 = R.chkY + (narrow ? 24 : H * 0.12);
      checks.forEach((c, i) => {
        const t0 = 0.14 + i * 0.014;
        put(c, ckX0 + track(p, [[t0, W * 1.2], [t0 + 0.06, 0]]), ckY0 + i * 52);
      });
      // radar rows rise from below the frame; wallet chips fly in from the corners and dock on the first row
      radar.forEach((r, i) => {
        const t0 = 0.4 + i * 0.02;
        put(r, radarX, radarY0 + i * 76 + track(p, [[t0, H * 0.9], [t0 + 0.06, 0]]));
      });
      chips.forEach((c, i) => {
        const from = [[-W * 0.6, -H * 0.5], [W * 1.2, -H * 0.4]][i];
        const k = track(p, [[0.44 + i * 0.02, 0], [0.5 + i * 0.02, 1]]);
        const tx = radarX + i * 132, ty = radarY0 - 44;
        put(c, lerp(tx + from[0], tx, k), lerp(ty + from[1], ty, k));
      });
      put(sig, radarX + track(p, [[0.5, W], [0.55, 0]]), radarY0 + 3 * 76 + 6);

      // the post comes in from the left, wires grow to the coins born after it, only the Safe one stays in frame
      const postW = Math.min(440, W - 2 * g);
      const postX = narrow ? g : W * 0.08, postY = R.postY + H * 0.14;
      put(post, postX + track(p, [[0.6, -W], [0.66, 0]]), postY);
      const bx = narrow ? g : W * 0.5, by = narrow ? postY + 180 : postY - 10;
      born.forEach((r, i) => {
        const t0 = 0.64 + i * 0.015;
        const outX = i === 0 ? 0 : track(p, [[0.72, 0], [0.77, W * 1.1]]);
        put(r, bx + track(p, [[t0, W * 0.7], [t0 + 0.05, 0]]) + outX, by + i * 76);
      });
      wires.forEach((w, i) => {
        if (narrow) return void (w.style.width = "0px");
        const k = track(p, [[0.65 + i * 0.015, 0], [0.7 + i * 0.015, 1]]);
        const outX = i === 0 ? 0 : track(p, [[0.72, 0], [0.77, W * 1.1]]);
        const x0 = postX + postW, y0 = postY + 60, x1 = bx + outX, y1 = by + i * 76 + 30;
        w.style.width = Math.hypot(x1 - x0, y1 - y0) * k + "px";
        w.style.transform = `translate(${x0}px, ${y0}px) rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`;
      });

      // the week's numbers roll up as the camera arrives
      const nx = narrow ? g : W * 0.08, ny = R.numY + H * 0.2;
      const roll = track(p, [[0.84, 0], [0.97, 1]]);
      nums.forEach((n, i) => {
        put(n, nx + (narrow ? 0 : i * Math.min(360, W * 0.3)), ny + (narrow ? i * 110 : 0) + track(p, [[0.82 + i * 0.02, H * 0.5], [0.88 + i * 0.02, 0]]));
        n.querySelector("b")!.textContent = Math.round(NUMS[i][1] * (p < 0.8 ? 1 : roll)).toLocaleString("en-US");
      });
      let b = BEATS[0];
      for (const x of BEATS) if (p >= x[0]) b = x;
      $(".cs-beat").textContent = b[1];
      $(".cs-cap").textContent = b[2];
      $(".cs-prog").style.width = p * 100 + "%";
    }
    const onScroll = () => requestAnimationFrame(render);
    addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    layout();
    return () => {
      removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="cs" ref={root}>
      <div className="cs-stage">
        <div className="cs-world">
          <div className="cs-el cs-hero">
            <span className="kicker">
              <i className="live" /> Every pump.fun launch, live
            </span>
            <h1>Every coin, read in one second.</h1>
            <p className="lead">Open any pump.fun coin on Axiom, GMGN or pump.fun. yeppo reads who holds it, who launched it and who funded them, then gives you one word: Safe, Risky or Danger.</p>
            <div className="hero-cta">
              <Link href="/extension" className="btn btn-go btn-lg">
                Add to Chrome
              </Link>
              <a href="#how" className="btn btn-lg btn-ghost">
                What it reads
              </a>
            </div>
            <div className="hero-try">
              <Search label="Read it" />
            </div>
          </div>

          <div className="cs-el cs-card cs-coin">
            <div className="cs-ctop">
              <span className="cs-ava">W</span>
              <div>
                <b>$WHATIF</b>
                <small>4 min old · mc $41.2k</small>
              </div>
              <span className="cs-tag">example</span>
            </div>
            <div className="cs-verdict">
              <i className="cs-vdot" />
              <b className="cs-vword">Checking</b>
              <span className="cs-vwhy">reading the launch blocks</span>
            </div>
            <div className="cs-bar">
              <i style={{ background: "var(--dev)" }} />
              <i style={{ background: "var(--mid)" }} />
              <i style={{ background: "var(--learn)" }} />
              <i style={{ background: "var(--cyan)" }} />
              <i style={{ background: "var(--line2)" }} />
            </div>
            <div className="cs-legend">
              {[["Creator", "0.8%", "var(--dev)"], ["Launch bundle", "3.1%", "var(--mid)"], ["Snipers", "2.4%", "var(--learn)"], ["Big wallets", "4.9%", "var(--cyan)"]].map(([n, v, c]) => (
                <div key={n}>
                  <span>
                    <i className="cs-sw" style={{ background: c }} />
                    {n}
                  </span>
                  <em>{v}</em>
                </div>
              ))}
            </div>
          </div>

          {CHECKS.map(([a, b, ok]) => (
            <div key={a} className="cs-el cs-check">
              <i className={ok ? "ok" : "ok warn"} />
              <span>{a}</span>
              <em>{b}</em>
            </div>
          ))}
          <div className="cs-radar">
            {ROWS.map(([ini, sym, line, cls, word]) => (
              <div key={sym} className="cs-el cs-rrow">
                <span className="cs-ava">{ini}</span>
                <div>
                  <b>{sym}</b>
                  <small>{line}</small>
                </div>
                <span className={`cs-pill ${cls}`}>{word}</span>
              </div>
            ))}
          </div>
          {["wallet one", "wallet two"].map((n, i) => (
            <div key={n} className="cs-el cs-chip">
              <i>{i + 1}</i>
              {n}
            </div>
          ))}
          <div className="cs-el cs-signal">early call · every check passes</div>

          <div className="cs-el cs-card cs-post">
            <div className="cs-who">
              <i />
              <div>
                <b>a large account</b>
                <br />
                <small>posted 2 min ago · seen on J7</small>
              </div>
            </div>
            <p>“the whale is back in the ocean”</p>
          </div>
          <div className="cs-born">
            {BORN.map((b) => (
              <div key={`w${b[0]}`} className="cs-el cs-wire" />
            ))}
            {BORN.map(([sym, word, cls]) => (
              <div key={sym} className="cs-el cs-rrow">
                <span className="cs-ava">{sym[1]}</span>
                <div>
                  <b>{sym}</b>
                  <small>born after the post</small>
                </div>
                <span className={`cs-pill ${cls}`}>{word}</span>
              </div>
            ))}
          </div>
          {NUMS.map(([label, n]) => (
            <div key={label} className="cs-el cs-num">
              <b>{n.toLocaleString("en-US")}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="cs-hud" aria-hidden>
          <i>
            <b className="cs-prog" />
          </i>
          <span className="cs-beat">01 Read</span>
        </div>
        <div className="cs-cap" aria-hidden>
          Scroll
        </div>
      </div>
    </div>
  );
}
