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

export type TimedLine = MemeLine & { at: number; typingFrom: number | null };
export type Timeline = { lines: TimedLine[]; chatEnd: number; duration: number; cues: { at: number; sfx: string; text: string }[] };

export const END_CARD_SECONDS = 1.8;

/**
 * Quando compare ogni messaggio. speed > 1 = più veloce.
 * Il bro "sta scrivendo…" prima di ogni sua risposta; dopo una battuta con suono c'è una pausa in più.
 */
export function buildTimeline(s: MemeScript, speed = 1): Timeline {
  const k = 1 / Math.max(0.5, Math.min(2, speed));
  let t = 1.0 * k; // tempo per leggere il POV
  const lines: TimedLine[] = [];
  s.lines.forEach((line, i) => {
    const prev = s.lines[i - 1];
    const typing = line.from !== "io" ? 0.55 * k : 0;
    // risposte a raffica dello stesso mittente: meno attesa
    const gap = prev && prev.from === line.from ? 0.15 * k : 0.25 * k;
    const typingFrom = typing ? t + gap : null;
    const at = t + gap + typing;
    lines.push({ ...line, at, typingFrom });
    const read = Math.min(2.6, Math.max(0.8, 0.55 + line.text.length * 0.04)) * k;
    t = at + read + (line.sfx ? 0.55 * k : 0);
  });
  const chatEnd = t + 0.4 * k;
  return {
    lines,
    chatEnd,
    duration: chatEnd + END_CARD_SECONDS,
    cues: lines.filter((l) => l.sfx).map((l) => ({ at: l.at, sfx: l.sfx, text: l.text })),
  };
}

/** 3.4 → "0:03.4" */
export function formatCue(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
