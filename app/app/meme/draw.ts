// Disegna un fotogramma del meme-chat (1080x1920, verticale) al secondo t.
import { BRAND } from "@/lib/brand";
import type { MemeScript, Timeline } from "@/lib/meme-script";

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
const INPUT_H = 150;
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

function drawInput(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, H - INPUT_H, W, INPUT_H);
  ctx.fillStyle = C.theirs;
  roundRect(ctx, 30, H - INPUT_H + 28, W - 190, 96, 48);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.font = `40px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Messaggio", 80, H - INPUT_H + 77);
  ctx.fillStyle = C.mine;
  ctx.beginPath();
  ctx.arc(W - 88, H - INPUT_H + 76, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `44px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("🎤", W - 88, H - INPUT_H + 78);
  ctx.textAlign = "left";
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
  const chatBottom = H - INPUT_H - 20;

  // messaggi visibili + eventuale "sta scrivendo"
  const bubbles: Bubble[] = [];
  let typing: { alpha: number } | null = null;
  for (const line of tl.lines) {
    if (t >= line.at) {
      const m = measureBubble(ctx, line.text, line.from === "yeppo");
      bubbles.push({ mine: line.from === "io", yeppo: line.from === "yeppo", ...m, progress: Math.min(1, (t - line.at) / 0.25) });
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
  drawInput(ctx);
  // titolo sopra a tutto, con un fondo che copre i messaggi che scorrono
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, headerTop);
  drawTitle(ctx, title.lines);

  if (t >= tl.chatEnd) drawEndCard(ctx, Math.min(1, (t - tl.chatEnd) / 0.25));
}
