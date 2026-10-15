/** Un telefono finto che scorre da solo un feed di snowboard: tutto in CSS. */
const CARDS = [
  { emoji: "❄️", title: "Linking turns: from C to S", learn: "Step 3 · Linking turns", hue: "d" },
  { emoji: "🏂", title: "How to ollie on a snowboard", learn: "Step 4 · The ollie", hue: "a" },
  { emoji: "🛬", title: "Pop higher, land softer", learn: "Step 4 · The ollie", hue: "e" },
  { emoji: "🧈", title: "3 butter tricks on flat ground", learn: "Step 6 · Butters", hue: "c" },
  { emoji: "🌀", title: "Frontside 180 for beginners", learn: "Step 7 · Your first 180", hue: "b" },
];

export function PhoneDemo() {
  const loop = [...CARDS, CARDS[0]];
  return (
    <div className="phone-wrap" aria-hidden>
      <div className="float-badge badge-1">
        <span className="dot dot-volt" /> Starts where you are
      </div>
      <div className="float-badge badge-2">Step 4 of 7 · in order</div>
      <div className="float-badge badge-3">✓ Saved, continue anytime</div>

      <div className="phone">
        <div className="phone-island" />
        <div className="phone-screen">
          <div className="phone-top">
            <span>Snowboarding · step</span>
            <span className="phone-count">
              <span className="phone-count-roll">
                <span>3/7</span>
                <span>4/7</span>
                <span>4/7</span>
                <span>6/7</span>
                <span>7/7</span>
                <span>3/7</span>
              </span>
            </span>
          </div>
          <div className="phone-track">
            {loop.map((c, i) => (
              <div key={i} className={`phone-card hue-${c.hue}`}>
                <div className="phone-emoji">{c.emoji}</div>
                <div className="phone-rail">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="phone-info">
                  <p className="phone-title">{c.title}</p>
                  <p className="phone-learn">✦ {c.learn}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
