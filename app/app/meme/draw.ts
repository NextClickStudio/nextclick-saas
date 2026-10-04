// Disegna un fotogramma del meme-chat (1080x1920, verticale) al secondo t.
// Grafica da chat di telefono in tema scuro (stile WhatsApp Android).
import { BRAND } from "@/lib/brand";
import { typedCount, type MemeScript, type Timeline, type TimedLine } from "@/lib/meme-script";

export const W = 1080;
export const H = 1920;

const FONT = `Roboto, "Helvetica Neue", Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const C = {
  bg: "#0b141a",
  bar: "#1f2c34",
  mine: "#005c4b",
  theirs: "#202c33",
  text: "#e9edef",
  muted: "#8696a0",
  icon: "#aebac1",
  green: "#00a884",
  tick: "#53bdeb",
  chip: "#182229",
  yeppo: "#a594ff",
};

const TITLE_TOP = 60;
const STATUS_H = 64;
const HEADER_H = 150;
const BUBBLE_FONT = 48;
const LINE_H = 62;
const PAD_X = 30;
const PAD_Y = 18;
const MAX_TEXT_W = 720;
const META_FONT = 30;
const SIDE = 34; // margine dei fumetti dal bordo
const KB_H = 600;
const INPUT_FONT = 44;
const INPUT_LINE = 56;
const START_MINUTES = 21 * 60 + 47; // orario del primo messaggio (21:47)

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function clock(index: number): string {
  const m = START_MINUTES + Math.floor(index / 3);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- titolo POV

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

// ---------------------------------------------------------------- sfondo con disegnini

let wallpaper: HTMLCanvasElement | null = null;

/** Trama leggera di scarabocchi (generata, non un'immagine esterna), calcolata una volta sola. */
function getWallpaper(): HTMLCanvasElement {
  if (wallpaper) return wallpaper;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,0.045)";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.lineJoin = "round";
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 30; y < H; y += 120) {
    for (let x = 30 + ((y / 120) % 2) * 60; x < W; x += 130) {
      const cx = x + rnd() * 40;
      const cy = y + rnd() * 40;
      const r = 14 + rnd() * 12;
      const kind = Math.floor(rnd() * 6);
      g.save();
      g.translate(cx, cy);
      g.rotate(rnd() * Math.PI * 2);
      g.beginPath();
      if (kind === 0) g.arc(0, 0, r, 0, Math.PI * 2);
      else if (kind === 1) {
        // stella
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
      } else if (kind === 2) {
        // cuore
        g.moveTo(0, r * 0.7);
        g.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.5, -r * 1.1, 0, -r * 0.35);
        g.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.4, -r * 0.2, 0, r * 0.7);
      } else if (kind === 3) {
        // onda
        g.moveTo(-r, 0);
        g.bezierCurveTo(-r / 2, -r, r / 2, r, r, 0);
      } else if (kind === 4) g.roundRect(-r * 0.8, -r * 0.6, r * 1.6, r * 1.2, 6);
      else {
        // fumetto
        g.arc(0, 0, r * 0.8, 0.3, Math.PI * 2 - 0.3);
        g.lineTo(r * 1.1, r * 0.6);
        g.closePath();
      }
      g.stroke();
      g.restore();
    }
  }
  wallpaper = c;
  return c;
}

// ---------------------------------------------------------------- barra di stato e header

function drawStatusBar(ctx: CanvasRenderingContext2D, top: number, time: string) {
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, top, W, STATUS_H);
  ctx.fillStyle = C.text;
  ctx.font = `500 34px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(time, 44, top + STATUS_H / 2 + 2);
  const y = top + STATUS_H / 2;
  // segnale
  for (let i = 0; i < 4; i++) ctx.fillRect(W - 250 + i * 13, y + 12 - (i + 1) * 6, 9, (i + 1) * 6);
  // wifi
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(W - 165, y + 14, 8 + i * 9, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  // batteria
  ctx.lineWidth = 3;
  roundRect(ctx, W - 120, y - 13, 56, 28, 6);
  ctx.stroke();
  ctx.fillRect(W - 62, y - 5, 5, 12);
  ctx.fillRect(W - 115, y - 8, 38, 18);
}

function drawHeader(ctx: CanvasRenderingContext2D, top: number, name: string, typing: boolean) {
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, top, W, HEADER_H);
  const cy = top + HEADER_H / 2;
  ctx.strokeStyle = C.text;
  ctx.fillStyle = C.text;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // freccia indietro
  ctx.beginPath();
  ctx.moveTo(72, cy);
  ctx.lineTo(30, cy);
  ctx.moveTo(48, cy - 18);
  ctx.lineTo(30, cy);
  ctx.lineTo(48, cy + 18);
  ctx.stroke();
  // avatar
  ctx.fillStyle = "#6a7175";
  ctx.beginPath();
  ctx.arc(140, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `60px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🗿", 140, cy + 5);
  ctx.textAlign = "left";
  ctx.fillStyle = C.text;
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(name, 218, cy - 22);
  ctx.fillStyle = typing ? C.green : C.muted;
  ctx.font = `33px ${FONT}`;
  ctx.fillText(typing ? "sta scrivendo..." : "online", 218, cy + 30);
  // icone: videochiamata, chiamata, menu (forme Material Icons, licenza Apache 2.0)
  ctx.fillStyle = C.icon;
  const icon = (path: string, x: number) => {
    ctx.save();
    ctx.translate(x - 30, cy - 30);
    ctx.scale(2.5, 2.5);
    ctx.fill(new Path2D(path));
    ctx.restore();
  };
  icon("M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z", W - 270);
  icon(
    "M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z",
    W - 160,
  );
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(W - 62, cy + i * 17, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDateChip(ctx: CanvasRenderingContext2D, y: number) {
  ctx.font = `500 32px ${FONT}`;
  const w = ctx.measureText("Oggi").width + 50;
  ctx.fillStyle = C.chip;
  roundRect(ctx, (W - w) / 2, y, w, 58, 14);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Oggi", W / 2, y + 30);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------- fumetti

type Bubble = {
  mine: boolean;
  yeppo: boolean;
  tail: boolean;
  lines: string[];
  w: number;
  h: number;
  time: string;
  metaInline: boolean;
  progress: number;
};

const NAME_H = 46;

function metaWidth(ctx: CanvasRenderingContext2D, time: string, mine: boolean) {
  ctx.font = `${META_FONT}px ${FONT}`;
  return ctx.measureText(time).width + (mine ? 52 : 0);
}

function measureBubble(ctx: CanvasRenderingContext2D, text: string, mine: boolean, yeppo: boolean, time: string) {
  ctx.font = `${BUBBLE_FONT}px ${FONT}`;
  const lines = wrap(ctx, text, MAX_TEXT_W);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const meta = metaWidth(ctx, time, mine) + 22;
  const last = widths[widths.length - 1] ?? 0;
  // l'orario sta sulla stessa riga dell'ultima parola se c'è spazio, se no va sotto
  const metaInline = last + meta <= MAX_TEXT_W;
  ctx.font = `600 36px ${FONT}`;
  const nameW = yeppo ? ctx.measureText("yeppo 💜").width : 0;
  const textW = Math.max(...widths, metaInline ? last + meta : meta, nameW);
  const h = lines.length * LINE_H + PAD_Y * 2 + (metaInline ? 0 : 38) + (yeppo ? NAME_H : 0);
  return { lines, w: textW + PAD_X * 2, h, metaInline };
}

function drawTicks(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = C.tick;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const dx of [0, 13]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.lineTo(x + dx + 8, y + 9);
    ctx.lineTo(x + dx + 24, y - 9);
    ctx.stroke();
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, y: number) {
  const x = b.mine ? W - SIDE - b.w : SIDE;
  const s = 0.86 + 0.14 * ease(b.progress / 0.6);
  const anchorX = b.mine ? x + b.w : x;
  ctx.save();
  ctx.globalAlpha = Math.min(1, b.progress * 2.5);
  ctx.translate(anchorX, y + b.h);
  ctx.scale(s, s);
  ctx.translate(-anchorX, -(y + b.h));
  ctx.fillStyle = b.mine ? C.mine : C.theirs;
  const r = 22;
  // angolo con la codina squadrato, come nelle chat vere
  roundRect(ctx, x, y, b.w, b.h, b.tail ? (b.mine ? [r, 0, r, r] : [0, r, r, r]) : r);
  ctx.fill();
  if (b.tail) {
    ctx.beginPath();
    if (b.mine) {
      ctx.moveTo(x + b.w - 2, y);
      ctx.lineTo(x + b.w + 20, y);
      ctx.quadraticCurveTo(x + b.w + 6, y + 10, x + b.w - 2, y + 30);
    } else {
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x - 20, y);
      ctx.quadraticCurveTo(x - 6, y + 10, x + 2, y + 30);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.textBaseline = "top";
  let ty = y + PAD_Y;
  if (b.yeppo) {
    ctx.fillStyle = C.yeppo;
    ctx.font = `600 36px ${FONT}`;
    ctx.fillText("yeppo 💜", x + PAD_X, ty);
    ty += NAME_H;
  }
  ctx.fillStyle = C.text;
  ctx.font = `${BUBBLE_FONT}px ${FONT}`;
  b.lines.forEach((l, i) => ctx.fillText(l, x + PAD_X, ty + i * LINE_H + 4));
  // orario + spunte blu
  ctx.font = `${META_FONT}px ${FONT}`;
  ctx.fillStyle = b.mine ? "rgba(233,237,239,0.6)" : C.muted;
  ctx.textBaseline = "alphabetic";
  const mw = metaWidth(ctx, b.time, b.mine);
  const my = y + b.h - 16;
  const mx = x + b.w - PAD_X + 6 - mw;
  ctx.fillText(b.time, mx, my);
  if (b.mine) drawTicks(ctx, mx + ctx.measureText(b.time).width + 12, my - 10);
  ctx.restore();
}

// ---------------------------------------------------------------- barra di scrittura e tastiera

type InputState = { text: string; caret: boolean; tapBar: number | null; tapSend: number | null; key: string | null };

function inputLayout(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `${INPUT_FONT}px ${FONT}`;
  const lines = text ? wrap(ctx, text, W - 400).slice(-4) : [];
  const boxH = Math.max(104, lines.length * INPUT_LINE + 48);
  return { lines, boxH, barH: boxH + 36 };
}

function drawTap(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  if (p < 0 || p > 1) return;
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - p)})`;
  ctx.beginPath();
  ctx.arc(x, y, 34 + 46 * ease(p), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSmiley(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = C.muted;
  ctx.fillStyle = C.muted;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + 3, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 8, y - 7, 3.5, 0, Math.PI * 2);
  ctx.arc(x + 8, y - 7, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawClip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 12);
  ctx.lineTo(-6, -14);
  ctx.arc(2, -14, 8, Math.PI, 0);
  ctx.lineTo(10, 18);
  ctx.arc(-2, 18, 12, 0, Math.PI);
  ctx.lineTo(-14, -6);
  ctx.stroke();
  ctx.restore();
}

function drawCamera(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 4.5;
  roundRect(ctx, x - 24, y - 16, 48, 36, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + 2, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.fillRect(x - 10, y - 23, 20, 7);
}

function drawMic(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#111b21";
  ctx.strokeStyle = "#111b21";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  roundRect(ctx, x - 10, y - 26, 20, 34, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 4, 17, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 13);
  ctx.lineTo(x, y + 24);
  ctx.stroke();
}

function drawSendArrow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#111b21";
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 24);
  ctx.lineTo(x + 26, y);
  ctx.lineTo(x - 20, y + 24);
  ctx.lineTo(x - 14, y + 4);
  ctx.lineTo(x + 6, y);
  ctx.lineTo(x - 14, y - 4);
  ctx.closePath();
  ctx.fill();
}

/** Barra "Messaggio" in basso (sopra la tastiera se è aperta). */
function drawInput(ctx: CanvasRenderingContext2D, bottom: number, st: InputState) {
  const { lines, boxH, barH } = inputLayout(ctx, st.text);
  const top = bottom - barH;
  const boxY = top + 14;
  const boxW = W - 24 - 130;
  ctx.fillStyle = C.bar;
  roundRect(ctx, 16, boxY, boxW, boxH, 52);
  ctx.fill();
  const iconY = boxY + boxH - 52;
  drawSmiley(ctx, 70, iconY);
  ctx.textBaseline = "middle";
  ctx.font = `${INPUT_FONT}px ${FONT}`;
  const textX = 122;
  if (lines.length) {
    ctx.fillStyle = C.text;
    lines.forEach((l, i) => ctx.fillText(l, textX, boxY + 24 + INPUT_LINE / 2 + i * INPUT_LINE));
  } else {
    ctx.fillStyle = C.muted;
    ctx.fillText("Messaggio", textX, boxY + boxH / 2 + 2);
  }
  if (st.caret) {
    const last = lines[lines.length - 1] ?? "";
    const cx = textX + (lines.length ? ctx.measureText(last).width + 3 : 0);
    const cy = lines.length ? boxY + 24 + INPUT_LINE / 2 + (lines.length - 1) * INPUT_LINE : boxY + boxH / 2;
    ctx.fillStyle = C.green;
    ctx.fillRect(cx, cy - 27, 4, 54);
  }
  // graffetta sempre, fotocamera solo con la barra vuota
  drawClip(ctx, st.text ? 16 + boxW - 60 : 16 + boxW - 140, iconY);
  if (!st.text) drawCamera(ctx, 16 + boxW - 58, iconY);
  // tasto verde: microfono o invio
  const sx = W - 76;
  const sy = boxY + boxH - 52;
  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.arc(sx, sy, 52, 0, Math.PI * 2);
  ctx.fill();
  if (st.text) drawSendArrow(ctx, sx + 2, sy);
  else drawMic(ctx, sx, sy);
  if (st.tapBar !== null) drawTap(ctx, 360, boxY + boxH / 2, st.tapBar);
  if (st.tapSend !== null) drawTap(ctx, sx, sy, st.tapSend);
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
  const base = ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /^[a-z]$/.test(base) ? base : null;
}

// ---------------------------------------------------------------- chiusura col marchio

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

// ---------------------------------------------------------------- fotogramma

/** Disegna il fotogramma al secondo t. */
export function drawFrame(ctx: CanvasRenderingContext2D, script: MemeScript, tl: Timeline, t: number, opts: DrawOptions) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const title = titleLayout(ctx, script.pov);
  const phoneTop = TITLE_TOP + title.height + 40;
  const headerTop = phoneTop + STATUS_H;
  const chatTop = headerTop + HEADER_H + 24;

  // sfondo della chat
  ctx.drawImage(getWallpaper(), 0, 0, W, H - phoneTop, 0, phoneTop, W, H - phoneTop);

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
  const chatBottom = kbTop - barH - 12;

  // messaggi visibili; il bro che scrive si vede solo nell'header, come nelle chat vere
  const bubbles: Bubble[] = [];
  let typing = false;
  let shown = 0;
  tl.lines.forEach((line, i) => {
    if (bubbles.length < i) return;
    if (t >= line.at) {
      const mine = line.from === "io";
      const yeppo = line.from === "yeppo";
      const time = clock(i);
      const prev = tl.lines[i - 1];
      bubbles.push({
        mine,
        yeppo,
        tail: !prev || prev.from !== line.from,
        time,
        ...measureBubble(ctx, line.text, mine, yeppo, time),
        progress: Math.min(1, (t - line.at) / 0.3),
      });
      shown = i;
    } else if (line.typingFrom !== null && t >= line.typingFrom) typing = true;
  });

  // altezza contenuto: l'ultimo messaggio "cresce" mentre entra, così lo scorrimento è morbido
  const CHIP_H = 58 + 26;
  let contentH = CHIP_H;
  bubbles.forEach((b, i) => {
    const gap = b.tail ? 22 : 8;
    contentH += (b.h + gap) * (i === bubbles.length - 1 ? ease(b.progress) : 1);
  });
  const offset = Math.max(0, contentH - (chatBottom - chatTop));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, headerTop + HEADER_H, W, chatBottom - headerTop - HEADER_H);
  ctx.clip();
  let y = chatTop - offset;
  drawDateChip(ctx, y);
  y += CHIP_H;
  for (const b of bubbles) {
    if (b.tail) y += 14;
    drawBubble(ctx, b, y);
    y += b.h + 8;
  }
  ctx.restore();

  drawStatusBar(ctx, phoneTop, clock(shown));
  drawHeader(ctx, headerTop, opts.botName, typing);
  if (kbP > 0) drawKeyboard(ctx, kbTop, input.key);
  drawInput(ctx, kbTop, input);
  // titolo sopra a tutto, su fondo nero
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, phoneTop);
  drawTitle(ctx, title.lines);

  if (t >= tl.chatEnd) drawEndCard(ctx, Math.min(1, (t - tl.chatEnd) / 0.25));
}
