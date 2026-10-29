"use client";

import { readLocal, writeLocal } from "@/lib/supabase";

export type Platform = { id: string; name: string; url: string | null; desc: string; hue: number };

// Each external platform opens on its own site: they all refuse to be shown inside another site, which
// protects your wallet. Whatever app sends the trade, it goes through the pump.fun program and yeppo sees it.
export const PLATFORMS: Platform[] = [
  { id: "yeppo", name: "yeppo terminal", url: null, desc: "Trade right here. Live coins, chart, presets, your wallet signs. Jupiter routes, no extra fee.", hue: 152 },
  { id: "pump", name: "pump.fun", url: "https://pump.fun/board", desc: "The launchpad itself.", hue: 140 },
  { id: "axiom", name: "Axiom", url: "https://axiom.trade/pulse", desc: "Pulse, presets, instant buys.", hue: 215 },
  { id: "gmgn", name: "GMGN", url: "https://gmgn.ai/?chain=sol", desc: "Trenches, smart money, sniping.", hue: 95 },
  { id: "photon", name: "Photon", url: "https://photon-sol.tinyastro.io/", desc: "Memescope and quick trades.", hue: 265 },
  { id: "bullx", name: "BullX NEO", url: "https://neo.bullx.io/", desc: "Pump vision and fast execution.", hue: 30 },
  { id: "padre", name: "Padre", url: "https://trade.padre.gg/", desc: "Pro terminal.", hue: 0 },
  { id: "fomo", name: "fomo", url: "https://fomo.family/", desc: "Phone app.", hue: 320 },
];

export const platformById = (id: string | null | undefined) => PLATFORMS.find((p) => p.id === id) ?? null;
export const savedPlatform = (code: string) => readLocal<string | null>(`yr:plat:${code}`, null) ?? null;
export const savePlatform = (code: string, id: string) => {
  writeLocal(`yr:plat:${code}`, id);
  writeLocal("yr:plat", id);
};
export const lastPlatform = () => readLocal<string | null>("yr:plat", null);

/** open an external platform in its own window, sized to sit next to yeppo */
export function openPlatform(p: Platform) {
  if (!p.url) return;
  const w = Math.min(1280, Math.max(900, Math.round(window.screen.availWidth * 0.66)));
  const h = Math.round(window.screen.availHeight * 0.9);
  const win = window.open(p.url, `yeppo-${p.id}`, `popup=yes,width=${w},height=${h},left=0,top=0`);
  if (!win) window.open(p.url, "_blank", "noopener");
}

export default function PlatformPicker({ onPick, current, walletShort }: { onPick: (p: Platform) => void; current: string | null; walletShort: string }) {
  const last = lastPlatform();
  return (
    <div className="plat">
      <div className="plat-head">
        <span className="eyebrow">
          <span className="chain-dot" /> Where do you trade?
        </span>
        <h2 className="display">Pick your platform</h2>
        <p className="muted small">
          Trade on yeppo or keep your usual app with all its settings. Every pump.fun trade from wallet <b className="mono">{walletShort}</b> is read from the
          chain and counted, wherever it comes from.
        </p>
      </div>
      <div className="plat-grid">
        {PLATFORMS.map((p) => (
          <button key={p.id} className={`plat-card ${p.id === "yeppo" ? "main" : ""} ${current === p.id ? "on" : ""}`} onClick={() => onPick(p)}>
            <span className="plat-ico mono" style={{ background: `hsl(${p.hue} 45% 13%)`, color: `hsl(${p.hue} 80% 65%)`, boxShadow: `inset 0 0 0 1px hsl(${p.hue} 45% 24%)` }}>
              {p.id === "yeppo" ? "y" : p.name.slice(0, 2)}
            </span>
            <span className="plat-txt">
              <b>
                {p.name}
                {p.id === "yeppo" && <span className="chip chip-up">Recommended</span>}
                {last === p.id && p.id !== "yeppo" && <span className="chip">Last used</span>}
              </b>
              <small>{p.desc}</small>
            </span>
            <span className="plat-go">{p.url ? "Opens in a new window ↗" : "Opens here →"}</span>
          </button>
        ))}
      </div>
      <p className="small dim plat-note">
        Apps like pump.fun, Axiom or GMGN cannot be shown inside another site: they block it to protect your wallet from phishing. That is why they open in
        their own window, with a floating scoreboard on top.
      </p>
    </div>
  );
}
