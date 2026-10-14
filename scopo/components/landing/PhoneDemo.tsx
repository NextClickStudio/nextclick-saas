/** Un telefono finto che scorre da solo un feed di snowboard: tutto in CSS. */
const CARDS = [
  { emoji: "🏂", title: "How to ollie on a snowboard", learn: "Pop off the tail, step by step", hue: "a" },
  { emoji: "🌀", title: "Frontside 180 for beginners", learn: "Your next trick after the ollie", hue: "b" },
  { emoji: "🧈", title: "3 butter tricks on flat ground", learn: "Balance on the nose and tail", hue: "c" },
  { emoji: "❄️", title: "Carving: edge control explained", learn: "Clean turns without skidding", hue: "d" },
  { emoji: "🛬", title: "Land your first jump", learn: "Where to look, how to absorb", hue: "e" },
];

export function PhoneDemo() {
  const loop = [...CARDS, CARDS[0]];
  return (
    <div className="phone-wrap" aria-hidden>
      <div className="float-badge badge-1">
        <span className="dot dot-volt" /> Only snowboarding. Nothing else.
      </div>
      <div className="float-badge badge-2">🇬🇧 English videos</div>
      <div className="float-badge badge-3">✦ 30-second lessons</div>

      <div className="phone">
        <div className="phone-island" />
        <div className="phone-screen">
          <div className="phone-top">
            <span>Snowboarding</span>
            <span className="phone-count">
              <span className="phone-count-roll">
                <span>1/12</span>
                <span>2/12</span>
                <span>3/12</span>
                <span>4/12</span>
                <span>5/12</span>
                <span>1/12</span>
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
