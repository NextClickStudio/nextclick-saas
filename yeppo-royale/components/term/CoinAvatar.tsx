"use client";

import { useEffect, useState } from "react";
import { coinImage } from "@/lib/pump";
import { hashStr } from "@/lib/rng";

/** the coin's own picture from its metadata, a tinted monogram until it loads (or if it never does) */
export default function CoinAvatar({ mint, uri, sym, size = 28, lazy = true }: { mint: string; uri: string | null | undefined; sym: string; size?: number; lazy?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let dead = false;
    setSrc(null);
    setBad(false);
    if (!uri) return;
    const go = () => coinImage(uri).then((u) => !dead && setSrc(u));
    const t = setTimeout(go, lazy ? 120 : 0);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [uri, lazy]);
  const h = hashStr(mint) % 360;
  return (
    <span
      className="cav mono"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `hsl(${h} 42% 14%)`,
        color: `hsl(${h} 80% 66%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 45% 24%)`,
      }}
    >
      {src && !bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} /> : sym.replace(/^\$/, "").slice(0, 2).toUpperCase()}
    </span>
  );
}
