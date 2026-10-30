"use client";

import { useEffect, useState } from "react";
import { useTween } from "@/lib/hooks";
import { coinJson } from "@/lib/meta";

export function Eye({ size = 30 }: { size?: number }) {
  return (
    <svg className="eye" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="eyeg" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#d6caff" />
          <stop offset=".55" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#2a1660" />
        </radialGradient>
      </defs>
      <path d="M6 32c6.5-11 15-16.5 26-16.5S51.5 21 58 32c-6.5 11-15 16.5-26 16.5S12.5 43 6 32z" fill="none" stroke="#8b5cff" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="10.5" fill="url(#eyeg)">
        <animate attributeName="r" values="10.5;9;10.5" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="35.5" cy="28.5" r="3" fill="#fff" opacity=".9" />
    </svg>
  );
}

/** a coin's picture from its metadata, or its initials on a gradient */
export function CoinImg({ uri, symbol, size = 44 }: { uri: string | null | undefined; symbol: string | null | undefined; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    setBad(false);
    void coinJson(uri).then((j) => alive && setSrc(j?.image ?? null));
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <div className="cimg" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {src && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBad(true)} />
      ) : (
        (symbol ?? "?").replace(/^\$/, "").slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

/** an animated number */
export function Num({ value, fmt, dur }: { value: number; fmt: (v: number) => string; dur?: number }) {
  const v = useTween(value, dur);
  return <>{fmt(v)}</>;
}

export function Ring({ value, size = 76, stroke = 7, color, label }: { value: number; size?: number; stroke?: number; color: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="ring-v">
        <b className="mono" style={{ fontSize: size * 0.26 }}>
          <Num value={v * 100} fmt={(x) => x.toFixed(0)} />
        </b>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Bar({ label, value, color, title }: { label: string; value: number; color: string; title?: string }) {
  return (
    <div className="bar" title={title}>
      <span className="dim">{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
      <span className="v mono">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}
