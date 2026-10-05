// Copioni dei meme "chat con il bro": formato testo modificabile a mano e tempi di comparsa dei messaggi nel video.

export type MemeFrom = "io" | "bro" | "yeppo";
export type MemeLine = { from: MemeFrom; text: string; sfx: string };
export type MemeScript = { pov: string; lines: MemeLine[] };

/**
 * Testo → copione. Una riga per messaggio:
 *   POV: chiedi al bro come trovare lead
 *   io: fra come trovo dei lead
 *   bro: il piombo fra. 3€ al chilo [vine boom]
 * Il suono va tra parentesi quadre (oppure dopo 🔊) in fondo alla riga.
 */
export function parseScript(text: string): MemeScript {
  let pov = "";
  const lines: MemeLine[] = [];
  for (const raw of text.split("\n")) {
    const row = raw.trim().replace(/^[-*•]\s*/, "");
    if (!row) continue;
    const povMatch = row.match(/^pov\s*:\s*(.*)$/i);
    if (povMatch) {
      pov = povMatch[1].trim();
      continue;
    }
    const m = row.match(/^(io|bro|yeppo)\s*:\s*(.*)$/i);
    if (!m) {
      // riga senza mittente: continua il messaggio precedente
      if (lines.length) lines[lines.length - 1].text += ` ${row}`;
      continue;
    }
    let body = m[2].trim();
    let sfx = "";
    const bracket = body.match(/\s*\[([^\]]*)\]\s*$/);
    const speaker = body.match(/\s*🔊\s*(.*)$/u);
    if (bracket) {
      sfx = bracket[1].trim();
      body = body.slice(0, bracket.index).trim();
    } else if (speaker) {
      sfx = speaker[1].trim();
      body = body.slice(0, speaker.index).trim();
    }
    if (body) lines.push({ from: m[1].toLowerCase() as MemeFrom, text: body, sfx });
  }
  return { pov, lines };
}

/** Copione → testo (stesso formato letto da parseScript). */
export function scriptToText(s: MemeScript): string {
  return [`POV: ${s.pov}`, ...s.lines.map((l) => `${l.from}: ${l.text}${l.sfx ? ` [${l.sfx}]` : ""}`)].join("\n");
}

/** Per i messaggi di "io": tocco sulla barra, scrittura lettera per lettera, tocco su invio. */
export type Compose = { from: number; typeStart: number; typeEnd: number; sendAt: number };
export type TimedLine = MemeLine & { at: number; typingFrom: number | null; compose: Compose | null };
export type Timeline = { lines: TimedLine[]; chatEnd: number; duration: number; cues: { at: number; sfx: string; text: string }[] };

export const END_CARD_SECONDS = 1.8;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Quando compare ogni messaggio. speed > 1 = più veloce.
 * I miei messaggi si vedono scrivere nella barra; il bro "sta scrivendo…" prima di rispondere;
 * dopo una battuta con suono c'è una pausa in più.
 */
export function buildTimeline(s: MemeScript, speed = 1): Timeline {
  const k = 1 / clamp(speed, 0.5, 2);
  let t = 1.5 * k; // tempo per leggere il POV
  const lines: TimedLine[] = [];
  s.lines.forEach((line, i) => {
    const prev = s.lines[i - 1];
    const gap = (prev && prev.from === line.from ? 0.35 : 0.6) * k;
    const len = line.text.length;
    if (line.from === "io") {
      const from = t + gap;
      const typeStart = from + 0.45 * k;
      const typeEnd = typeStart + clamp(len * 0.07, 0.6, 3.4) * k;
      const sendAt = typeEnd + 0.35 * k;
      const at = sendAt + 0.12 * k;
      lines.push({ ...line, at, typingFrom: null, compose: { from, typeStart, typeEnd, sendAt } });
      // il messaggio l'abbiamo già letto mentre veniva scritto
      t = at + 0.7 * k + (line.sfx ? 0.9 * k : 0);
    } else {
      const typingFrom = t + gap;
      const at = typingFrom + clamp(0.9 + len * 0.02, 1.0, 2.0) * k;
      lines.push({ ...line, at, typingFrom, compose: null });
      t = at + clamp(1.0 + len * 0.045, 1.4, 3.4) * k + (line.sfx ? 0.9 * k : 0);
    }
  });
  const chatEnd = t + 0.6 * k;
  return {
    lines,
    chatEnd,
    duration: chatEnd + END_CARD_SECONDS,
    cues: lines.filter((l) => l.sfx).map((l) => ({ at: l.at, sfx: l.sfx, text: l.text })),
  };
}

/** Quanti caratteri (emoji comprese) del messaggio sono già scritti nella barra al secondo t. */
export function typedCount(line: TimedLine, t: number): number {
  const c = line.compose;
  const total = [...line.text].length;
  if (!c || t < c.typeStart) return 0;
  if (t >= c.typeEnd) return total;
  return Math.floor(((t - c.typeStart) / (c.typeEnd - c.typeStart)) * total);
}

/** 3.4 → "0:03.4" */
export function formatCue(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
