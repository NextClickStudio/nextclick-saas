// Tiny synth blips for the live story. Off until the visitor turns it on.

let ctx: AudioContext | null = null;
let on = false;
try {
  on = typeof window !== "undefined" && window.localStorage.getItem("yo:sound") === "on";
} catch {
  /* ignore */
}
export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  try {
    window.localStorage.setItem("yo:sound", v ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (v) blip("up");
}

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

let last = 0;
export function blip(kind: "up" | "down" | "gold" | "info") {
  if (!on || Date.now() - last < 900) return;
  last = Date.now();
  const a = audio();
  if (!a) return;
  const notes = kind === "up" ? [660, 990] : kind === "gold" ? [784, 1175, 1568] : kind === "down" ? [330, 220] : [520];
  notes.forEach((f, i) => {
    const t = a.currentTime + i * 0.07;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = kind === "down" ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.18);
  });
}
