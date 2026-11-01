"use client";

import { useEffect, useState } from "react";
import { useTween } from "@/lib/hooks";
import { coinJson, mirrors } from "@/lib/meta";

/** a coin's picture (given, or from its metadata), or its initials on a gradient */
export function CoinImg({ uri, src: given, symbol, size = 44 }: { uri: string | null | undefined; src?: string | null; symbol: string | null | undefined; size?: number }) {
  const [srcs, setSrcs] = useState<string[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let alive = true;
    setI(0);
    if (given) setSrcs([given]);
    else {
      setSrcs([]);
      void coinJson(uri).then((j) => alive && setSrcs(j?.image ? mirrors(j.image) : []));
    }
    return () => {
      alive = false;
    };
  }, [uri, given]);
  const src = srcs[i];
  return (
    <div className="cimg" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setI((n) => n + 1)} />
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
