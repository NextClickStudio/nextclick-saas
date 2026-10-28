"use client";

import TopBar from "./TopBar";

const ITEMS = [
  { name: "Second Chance", kind: "Boost", art: "💖", bg: "linear-gradient(160deg,#ff4fb3,#5b0b3a)", text: "Survive one cut you would have lost." },
  { name: "Rug Radar", kind: "Boost", art: "📡", bg: "linear-gradient(160deg,#2fe6ff,#06364a)", text: "Highlights the dev wallet's moves live." },
  { name: "Golden Bean", kind: "Outfit", art: "🏆", bg: "linear-gradient(160deg,#ffd400,#5a3d00)", text: "A solid gold trencher. Flex only." },
  { name: "Laser Visor", kind: "Eyewear", art: "🕶️", bg: "linear-gradient(160deg,#8b5cff,#1d0f4a)", text: "Pure vibes. Zero edge." },
  { name: "Whale Bag", kind: "Boost", art: "🐳", bg: "linear-gradient(160deg,#2fa8ff,#071b4f)", text: "Start a casual match with 12 SOL." },
  { name: "Diamond Hands", kind: "Emote", art: "💎", bg: "linear-gradient(160deg,#62a8ff,#0b1c4a)", text: "Spam it in the kill feed." },
  { name: "Moon Boots", kind: "Outfit", art: "🚀", bg: "linear-gradient(160deg,#ff8a00,#5a1d00)", text: "Leave a trail when you win." },
  { name: "Ape Crown", kind: "Headwear", art: "👑", bg: "linear-gradient(160deg,#ffd400,#8a1a4f)", text: "For the last trader standing." },
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
            <p className="muted">Boosts, outfits and emotes. Opening soon. Everything here will be earned by playing.</p>
          </div>
          <span className="chip chip-gold">COMING SOON</span>
        </div>
        <div className="shop-grid">
          {ITEMS.map((it) => (
            <div key={it.name} className="shop-item" style={{ background: it.bg }}>
              <div className="art">{it.art}</div>
              <span className="chip lock">🔒 Locked</span>
              <div className="info">
                <span className="lbl" style={{ color: "#dfe4ff" }}>
                  {it.kind}
                </span>
                <b className="display">{it.name}</b>
                <span className="small" style={{ color: "#dfe4ff" }}>
                  {it.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
