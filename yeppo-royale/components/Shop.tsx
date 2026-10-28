"use client";

import TopBar from "./TopBar";

const ITEMS = [
  { name: "Second Chance", kind: "Boost", art: "💖", text: "Survive one cut you would have lost." },
  { name: "Rug Radar", kind: "Boost", art: "📡", text: "Highlights the dev wallet's moves live." },
  { name: "Golden Ring", kind: "Profile", art: "🏆", text: "A gold ring around your picture. Flex only." },
  { name: "Laser Visor", kind: "Eyewear", art: "🕶️", text: "Pure vibes. Zero edge." },
  { name: "Whale Bag", kind: "Boost", art: "🐳", text: "Start a casual match with 12 SOL." },
  { name: "Diamond Hands", kind: "Emote", art: "💎", text: "Spam it in the live feed." },
  { name: "Moon Trail", kind: "Effect", art: "🚀", text: "Leave a trail when you win." },
  { name: "Ape Crown", kind: "Top", art: "👑", text: "For the last trader standing." },
];

export default function Shop() {
  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="display">Item shop</h1>
            <p className="muted">Boosts, profile items and emotes. Opening soon. Everything here will be earned by playing.</p>
          </div>
          <span className="chip chip-gold">COMING SOON</span>
        </div>
        <div className="shop-grid">
          {ITEMS.map((it) => (
            <div key={it.name} className="shop-item">
              <div className="art">{it.art}</div>
              <span className="chip lock">Locked</span>
              <div className="info">
                <span className="lbl">{it.kind}</span>
                <b>{it.name}</b>
                <span className="small muted">{it.text}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
