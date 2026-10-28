// Dopamine layer: toasts, confetti, floating numbers, edge glow and synth sounds.
// Everything is event-based so any component can fire effects without prop drilling.

export type FxKind = "up" | "down" | "info";

const emit = (name: string, detail: unknown) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
};

export const toast = (text: string, kind: FxKind = "info") => emit("yeppo:toast", { text, kind });
export const confetti = (x?: number, y?: number) => emit("yeppo:confetti", { x, y });
export const floatText = (text: string, x: number, y: number, kind: FxKind = "up") => emit("yeppo:float", { text, x, y, kind });
export const edgeGlow = (kind: "up" | "down") => emit("yeppo:edge", { kind });

export function centerOf(el: Element | null | undefined) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// --- sound ---

let ctx: AudioContext | null = null;
let soundOn = true;
try {
  soundOn = typeof window === "undefined" || window.localStorage.getItem("yeppo:sound") !== "off";
} catch {
  /* ignore */
}

export const isSoundOn = () => soundOn;
export function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    window.localStorage.setItem("yeppo:sound", on ? "on" : "off");
  } catch {
    /* ignore */
  }
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

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.05, delay = 0, slideTo?: number) {
  if (!soundOn) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  buy() {
    tone(520, 0.08, "square", 0.035);
    tone(880, 0.12, "square", 0.03, 0.06);
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, "triangle", 0.055, i * 0.06));
  },
  lose() {
    tone(240, 0.32, "sawtooth", 0.03, 0, 90);
  },
  rank() {
    tone(988, 0.1, "triangle", 0.045);
    tone(1319, 0.16, "triangle", 0.045, 0.08);
  },
  tick() {
    tone(1500, 0.03, "sine", 0.02);
  },
  go() {
    tone(392, 0.12, "square", 0.04);
    tone(784, 0.25, "square", 0.04, 0.1);
  },
  error() {
    tone(150, 0.16, "square", 0.035);
  },
};
