"use client";

import { useEffect, useRef, useState } from "react";
import { solPrice, solPriceNow } from "./meta";

/** call fn now and every ms (four times slower while the tab is hidden); keeps the last good value.
 *  reload() calls it again right away, keeping what is shown until the new value lands. */
/** ms: the wait between calls, or a function asked before each wait (so it can follow what the last call returned) */
export function usePoll<T>(fn: (() => Promise<T>) | null, ms: number | (() => number), key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const msRef = useRef(ms);
  msRef.current = ms;
  const again = useRef<() => void>(() => {});
  useEffect(() => {
    setData(null);
    setError(null);
    if (!fnRef.current) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let seq = 0; // only the latest call shows its result and schedules the next one
    const tick = async () => {
      const my = ++seq;
      try {
        const v = await fnRef.current!();
        if (!alive || my !== seq) return;
        setData(v);
        setError(null);
      } catch (e) {
        if (!alive || my !== seq) return;
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
      const wait = typeof msRef.current === "function" ? msRef.current() : msRef.current;
      timer = setTimeout(tick, document.hidden ? wait * 4 : wait);
    };
    void tick();
    again.current = () => {
      clearTimeout(timer);
      void tick();
    };
    const vis = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", vis);
    };
    // ms is read through msRef at each wait: a new value (or a new function each render) must not restart the calls
  }, [key]);
  return { data, error, reload: () => again.current() };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useSol() {
  const [p, setP] = useState(solPriceNow());
  useEffect(() => {
    let alive = true;
    const go = () => solPrice().then((v) => alive && v && setP(v));
    go();
    const t = setInterval(go, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return p;
}

/** a number that glides to its new value */
export function useTween(value: number, dur = 700) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  const cur = useRef(value);
  useEffect(() => {
    from.current = cur.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from.current + (value - from.current) * e;
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return v;
}
