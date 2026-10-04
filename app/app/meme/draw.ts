// Disegna un fotogramma del meme-chat (1080x1920, verticale) al secondo t.
import { BRAND } from "@/lib/brand";
import { typedCount, type MemeScript, type Timeline, type TimedLine } from "@/lib/meme-script";

export const W = 1080;
export const H = 1920;

const FONT = `"Helvetica Neue", Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const C = {
  bg: "#0b141a",
  header: "#1f2c34",
  mine: "#7c6cff",
  theirs: "#202c33",
  text: "#e9edef",
  muted: "#8696a0",
};

const TITLE_TOP = 70;
const HEADER_H = 150;
const BUBBLE_FONT = 50;
const LINE_H = 64;
const PAD_X = 34;
const PAD_Y = 22;
const MAX_TEXT_W = 700;
const GAP = 18;

export type DrawOptions = { botName: string };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    // parola più lunga della riga: spezzala
    let rest = word;
    while (ctx.measureText(rest).width > maxW && rest.length > 1) {
      let n = rest.length - 1;
      while (n > 1 && ctx.measureText(rest.slice(0, n)).width > maxW) n--;
      out.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    line = rest;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function titleLayout(ctx: CanvasRenderingContext2D, pov: string) {
  ctx.font = `800 66px ${FONT}`;
  const lines = wrap(ctx, `POV: ${pov}`, W - 140).slice(0, 4);
  return { lines, height: lines.length * 80 };
}

function drawTitle(ctx: CanvasRenderingContext2D, lines: string[]) {
  ctx.font = `800 66px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  lines.forEach((l, i) => {
    const y = TITLE_TOP + i * 80;
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#000";
    ctx.strokeText(l, W / 2, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(l, W / 2, y);
  });
  ctx.textAlign = "left";
}

function drawHeader(ctx: CanvasRenderingContext2D, top: number, name: string, typing: boolean) {
  ctx.fillStyle = C.header;
  ctx.fillRect(0, top, W, HEADER_H);
  // freccia indietro
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(78, top + 52);
  ctx.lineTo(54, top + 75);
  ctx.lineTo(78, top + 98);
  ctx.stroke();
  // avatar
  ctx.fillStyle = "#3b4a54";
  ctx.beginPath();
  ctx.arc(160, top + 75, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `56px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("🗿", 160, top + 79);
  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(name, 236, top + 56);
  ctx.fillStyle = typing ? "#25d366" : C.muted;
  ctx.font = `34px ${FONT}`;
  ctx.fillText(typing ? "sta scrivendo…" : "online", 236, top + 106);
}

const KB_H = 600;
const INPUT_FONT = 42;
const INPUT_LINE = 54;

type InputState = { text: string; caret: boolean; tapBar: number | null; tapSend: number | null; key: string | null };

function inputLayout(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `${INPUT_FONT}px ${FONT}`;
  const lines = text ? wrap(ctx, text, W - 330).slice(-3) : [];
  const boxH = Math.max(96, lines.length * INPUT_LINE + 42);
  return { lines, boxH, barH: boxH + 54 };
}

function drawTap(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  if (p < 0 || p > 1) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - p)})`;
  ctx.beginPath();
  ctx.arc(x, y, 34 + 46 * ease(p), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Barra "Messaggio" in basso (sopra la tastiera se è aperta). */
function drawInput(ctx: CanvasRenderingContext2D, bottom: number, st: InputState) {
  const { lines, boxH, barH } = inputLayout(ctx, st.text);
  const top = bottom - barH;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, top, W, barH);
  const boxY = top + 28;
  ctx.fillStyle = C.theirs;
  roundRect(ctx, 30, boxY, W - 190, boxH, 48);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.font = `${INPUT_FONT}px ${FONT}`;
  if (lines.length) {
    ctx.fillStyle = C.text;
    lines.forEach((l, i) => ctx.fillText(l, 80, boxY + 21 + INPUT_LINE / 2 + i * INPUT_LINE));
  } else if (!st.caret) {
    ctx.fillStyle = C.muted;
    ctx.fillText("Messaggio", 80, boxY + boxH / 2);
  }
  if (st.caret) {
    const last = lines[lines.length - 1] ?? "";
    const cx = 80 + ctx.measureText(last).width + 4;
    const cy = lines.length ? boxY + 21 + INPUT_LINE / 2 + (lines.length - 1) * INPUT_LINE : boxY + boxH / 2;
    ctx.fillStyle = "#25d366";
    ctx.fillRect(cx, cy - 26, 4, 52);
  }
  // invio: microfono se la barra è vuota, freccia se c'è testo
  const sx = W - 88;
  const sy = boxY + boxH - 48;
  ctx.fillStyle = C.mine;
  ctx.beginPath();
  ctx.arc(sx, sy, 50, 0, Math.PI * 2);
  ctx.fill();
  if (st.text) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(sx - 20, sy - 24);
    ctx.lineTo(sx + 26, sy);
    ctx.lineTo(sx - 20, sy + 24);
    ctx.lineTo(sx - 12, sy);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.font = `44px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("🎤", sx, sy + 2);
    ctx.textAlign = "left";
  }
  if (st.tapBar !== null) drawTap(ctx, 300, boxY + boxH / 2, st.tapBar);
  if (st.tapSend !== null) drawTap(ctx, sx, sy, st.tapSend);
  return barH;
}

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Tastiera del telefono; il tasto appena premuto si illumina. */
function drawKeyboard(ctx: CanvasRenderingContext2D, top: number, pressed: string | null) {
  ctx.fillStyle = "#1b1f23";
  ctx.fillRect(0, top, W, KB_H);
  const gap = 14;
  const kw = (W - 24 - gap * 9) / 10;
  const kh = 116;
  const key = (x: number, y: number, w: number, label: string, on: boolean, dim = false) => {
    ctx.fillStyle = on ? "#8a8f96" : dim ? "#2c3035" : "#3d4146";
    roundRect(ctx, x, y, w, kh, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `${label.length > 1 ? 34 : 50}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + kh / 2 + 2);
    ctx.textAlign = "left";
  };
  KEY_ROWS.forEach((row, r) => {
    const y = top + 22 + r * (kh + 18);
    const rowW = row.length * kw + (row.length - 1) * gap;
    let x = (W - rowW) / 2;
    if (r === 2) {
      key(12, y, kw * 1.35, "⇧", false, true);
      key(W - 12 - kw * 1.35, y, kw * 1.35, "⌫", false, true);
    }
    for (const ch of row) {
      key(x, y, kw, ch, pressed === ch);
      x += kw + gap;
    }
  });
  const y = top + 22 + 3 * (kh + 18);
  key(12, y, kw * 2.2, "123", false, true);
  key(24 + kw * 2.2, y, W - 48 - kw * 4.6, "spazio", pressed === " ");
  key(W - 12 - kw * 2.2, y, kw * 2.2, "invio", false, true);
}

/** Tasto della tastiera per un carattere (accenti → lettera base). */
function keyFor(ch: string | undefined): string | null {
  if (!ch) return null;
  if (/\s/.test(ch)) return " ";
  const base = ch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /^[a-z]$/.test(base) ? base : null;
}

type Bubble = { mine: boolean; yeppo: boolean; lines: string[]; w: number; h: number; progress: number };

const bubbleFont = (yeppo: boolean) => `${yeppo ? "600 " : ""}${BUBBLE_FONT}px ${FONT}`;

function measureBubble(ctx: CanvasRenderingContext2D, text: string, yeppo: boolean) {
  ctx.font = bubbleFont(yeppo);
  const lines = wrap(ctx, text, MAX_TEXT_W);
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), yeppo ? 170 : 0);
  return { lines, w: textW + PAD_X * 2, h: lines.length * LINE_H + PAD_Y * 2 + (yeppo ? 50 : 0) };
}

function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, y: number) {
  const x = b.mine ? W - 40 - b.w : 40;
  const s = 0.82 + 0.18 * ease(b.progress / 0.6);
  ctx.save();
  ctx.globalAlpha = Math.min(1, b.progress * 2.5);
  ctx.translate(b.mine ? x + b.w : x, y + b.h);
  ctx.scale(s, s);
  ctx.translate(-(b.mine ? x + b.w : x), -(y + b.h));
  if (b.yeppo) {
    const g = ctx.createLinearGradient(x, y, x + b.w, y + b.h);
    g.addColorStop(0, BRAND.from);
    g.addColorStop(1, BRAND.to);
    ctx.fillStyle = g;
  } else ctx.fillStyle = b.mine ? C.mine : C.theirs;
  roundRect(ctx, x, y, b.w, b.h, 34);
  ctx.fill();
  ctx.textBaseline = "top";
  let ty = y + PAD_Y;
  if (b.yeppo) {
    ctx.fillStyle = BRAND.bg;
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText("yeppo 💜", x + PAD_X, ty);
    ty += 50;
  }
  ctx.fillStyle = b.yeppo ? BRAND.bg : "#fff";
  ctx.font = bubbleFont(b.yeppo);
  b.lines.forEach((l, i) => ctx.fillText(l, x + PAD_X, ty + i * LINE_H + 4));
  ctx.restore();
}

function drawTyping(ctx: CanvasRenderingContext2D, y: number, t: number, alpha: number) {
  const w = 170;
  const h = 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.theirs;
  roundRect(ctx, 40, y, w, h, 34);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const bounce = Math.sin(t * 9 - i * 0.9);
    ctx.fillStyle = `rgba(233,237,239,${0.45 + 0.4 * Math.max(0, bounce)})`;
    ctx.beginPath();
    ctx.arc(40 + 50 + i * 36, y + h / 2 - Math.max(0, bounce) * 8, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEndCard(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = BRAND.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H / 2 - 200, 0, W / 2, H / 2 - 200, 700);
  glow.addColorStop(0, "rgba(165,148,255,0.35)");
  glow.addColorStop(1, "rgba(165,148,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // marchio Y
  const size = 360;
  ctx.translate(W / 2 - size / 2, H / 2 - 520);
  ctx.scale(size / 64, size / 64);
  const g = ctx.createLinearGradient(14, 15, 50, 50);
  g.addColorStop(0, BRAND.from);
  g.addColorStop(1, BRAND.to);
  ctx.fillStyle = g;
  ctx.fill(new Path2D(BRAND.y));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `800 150px ${FONT}`;
  ctx.fillText("yeppo", W / 2, H / 2 + 20);
  ctx.font = `600 58px ${FONT}`;
  ctx.fillStyle = "#d4cfff";
  ctx.fillText("yeppo trova clienti.", W / 2, H / 2 + 190);
  ctx.fillText("il bro no.", W / 2, H / 2 + 265);
  ctx.font = `500 44px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText("yeppo.it", W / 2, H - 220);
  ctx.restore();
}

/** Disegna il fotogramma al secondo t. */
export function drawFrame(ctx: CanvasRenderingContext2D, script: MemeScript, tl: Timeline, t: number, opts: DrawOptions) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const title = titleLayout(ctx, script.pov);
  const headerTop = TITLE_TOP + title.height + 50;
  const chatTop = headerTop + HEADER_H + 30;

  // tastiera: si apre al primo tocco sulla barra e resta aperta
  const firstCompose = tl.lines.find((l) => l.compose)?.compose?.from ?? Infinity;
  const kbP = ease((t - firstCompose) / 0.3);
  const kbTop = H - KB_H * kbP;

  // cosa sto scrivendo adesso nella barra
  const composing: TimedLine | undefined = tl.lines.find((l) => l.compose && t >= l.compose.from && t < l.at);
  const input: InputState = { text: "", caret: false, tapBar: null, tapSend: null, key: null };
  if (composing?.compose) {
    const c = composing.compose;
    const chars = [...composing.text];
    const n = typedCount(composing, t);
    input.text = chars.slice(0, n).join("");
    input.caret = t < c.sendAt && (t < c.typeEnd || Math.floor(t * 2.5) % 2 === 0);
    input.tapBar = (t - c.from) / 0.35;
    input.tapSend = t >= c.sendAt ? (t - c.sendAt) / 0.35 : null;
    if (t < c.typeEnd && n > 0) input.key = keyFor(chars[n - 1]);
  }
  // il tocco su invio sfuma anche dopo che il messaggio è partito
  const justSent = tl.lines.find((l) => l.compose && t >= l.at && t < l.compose.sendAt + 0.35);
  if (justSent?.compose) input.tapSend = (t - justSent.compose.sendAt) / 0.35;
  const barH = inputLayout(ctx, input.text).barH;
  const chatBottom = kbTop - barH - 20;

  // messaggi visibili + eventuale "sta scrivendo"
  const bubbles: Bubble[] = [];
  let typing: { alpha: number } | null = null;
  for (const line of tl.lines) {
    if (t >= line.at) {
      const m = measureBubble(ctx, line.text, line.from === "yeppo");
      bubbles.push({ mine: line.from === "io", yeppo: line.from === "yeppo", ...m, progress: Math.min(1, (t - line.at) / 0.3) });
    } else if (line.typingFrom !== null && t >= line.typingFrom) {
      typing = { alpha: Math.min(1, (t - line.typingFrom) / 0.15) };
      break;
    } else break;
  }

  // altezza contenuto: l'ultimo messaggio "cresce" mentre entra, così lo scorrimento è morbido
  let contentH = 0;
  bubbles.forEach((b, i) => (contentH += (b.h + GAP) * (i === bubbles.length - 1 ? ease(b.progress) : 1)));
  if (typing) contentH += (100 + GAP) * typing.alpha;
  const offset = Math.max(0, contentH - (chatBottom - chatTop));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, chatTop - 10, W, chatBottom - chatTop + 10);
  ctx.clip();
  let y = chatTop - offset;
  for (const b of bubbles) {
    drawBubble(ctx, b, y);
    y += b.h + GAP;
  }
  if (typing) drawTyping(ctx, y, t, typing.alpha);
  ctx.restore();

  drawHeader(ctx, headerTop, opts.botName, Boolean(typing));
  if (kbP > 0) drawKeyboard(ctx, kbTop, input.key);
  drawInput(ctx, kbTop, input);
  // titolo sopra a tutto, con un fondo che copre i messaggi che scorrono
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, headerTop);
  drawTitle(ctx, title.lines);

  if (t >= tl.chatEnd) drawEndCard(ctx, Math.min(1, (t - tl.chatEnd) / 0.25));
}
