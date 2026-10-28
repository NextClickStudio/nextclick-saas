// Decorative arena preview for the lobby hero (pure SVG/CSS, no data).
const CANDLES = (() => {
  const out: { o: number; c: number; h: number; l: number }[] = [];
  let p = 60;
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30; i++) {
    const o = p;
    p = Math.max(18, p + (r() - 0.38) * 14);
    out.push({ o, c: p, h: Math.max(o, p) + r() * 6, l: Math.min(o, p) - r() * 6 });
  }
  return out;
})();

export default function HeroVisual() {
  const W = 420;
  const H = 200;
  const max = Math.max(...CANDLES.map((c) => c.h));
  const min = Math.min(...CANDLES.map((c) => c.l));
  const y = (v: number) => H - ((v - min) / (max - min)) * (H - 16) - 8;
  const step = W / CANDLES.length;
  const last = CANDLES[CANDLES.length - 1];

  return (
    <div className="hero-visual" aria-hidden>
      <div className="hv-card">
        <div className="hv-top">
          <span className="status-pill st-live">
            <i className="live-dot" />
            LIVE
          </span>
          <b className="mono">$FROG</b>
          <span className="mono t-up">+184%</span>
          <span className="hv-clock mono">07:42</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="hv-chart">
          <line x1="0" x2={W} y1={y(last.c)} y2={y(last.c)} className="hv-priceline" />
          {CANDLES.map((c, i) => {
            const up = c.c >= c.o;
            const x = i * step + step / 2;
            const top = y(Math.max(c.o, c.c));
            const bh = Math.max(2, Math.abs(y(c.o) - y(c.c)));
            return (
              <g key={i} className={`${up ? "hv-up" : "hv-down"} ${i === CANDLES.length - 1 ? "hv-last" : ""}`}>
                <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} />
                <rect x={x - step * 0.32} y={top} width={step * 0.64} height={bh} rx="1" />
              </g>
            );
          })}
        </svg>
        <div className="hv-board">
          <div>
            <span>🥇</span>
            <b>degenlord</b>
            <span className="mono t-up">+56.2%</span>
          </div>
          <div className="hv-me">
            <span>🥈</span>
            <b>
              tu <em>TU</em>
            </b>
            <span className="mono t-up">+41.8%</span>
          </div>
          <div>
            <span>🥉</span>
            <b>solqueen</b>
            <span className="mono t-up">+29.0%</span>
          </div>
        </div>
      </div>
      <div className="hv-chip hv-chip-up mono">+2.41 SOL 🚀</div>
      <div className="hv-chip hv-chip-rank mono">▲ #2</div>
      <div className="hv-chip hv-chip-down mono">🩸 -0.38 SOL</div>
    </div>
  );
}
