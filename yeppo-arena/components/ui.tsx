"use client";

import { useState } from "react";
import { hashColor } from "@/lib/format";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="logo" aria-label="yeppo home">
      yeppo<i />
    </a>
  );
}

export function CoinAvatar({ image, symbol, mint, size = 28 }: { image?: string | null; symbol: string; mint: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={image} alt="" style={style} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ ...style, background: hashColor(mint), fontSize: size * 0.42 }} aria-hidden>
      {symbol.replace(/^\$/, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <label>{label}</label>
      <b className={tone ? `t-${tone}` : undefined}>{value}</b>
    </div>
  );
}
