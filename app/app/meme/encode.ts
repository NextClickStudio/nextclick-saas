// Crea il file MP4 del meme fotogramma per fotogramma (WebCodecs + Mediabunny):
// tempi esatti a 30 fps, più veloce del tempo reale e senza i difetti di registrazione di Safari.
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from "mediabunny";
import type { MemeScript, Timeline } from "@/lib/meme-script";
import { drawFrame, H, W } from "./draw";

export const FPS = 30;
const SAMPLE_RATE = 48000;

/** "Pop" sintetico all'arrivo di un messaggio (nessun audio esterno, nessun diritto). */
export function playPop(ac: BaseAudioContext, outs: AudioNode[], when: number, mine: boolean) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(mine ? 900 : 650, when);
  osc.frequency.exponentialRampToValueAtTime(mine ? 1500 : 1100, when + 0.06);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.35, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
  osc.connect(gain);
  for (const o of outs) gain.connect(o);
  osc.start(when);
  osc.stop(when + 0.14);
}

/** Clic leggero di un tasto mentre scrivo nella barra. */
export function playTick(ac: BaseAudioContext, outs: AudioNode[], when: number) {
  const len = Math.floor(ac.sampleRate * 0.012);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buf;
  gain.gain.value = 0.18;
  src.connect(gain);
  for (const o of outs) gain.connect(o);
  src.start(when);
}

/** Tutti i suoni della chat con il loro secondo esatto. */
export function chatSounds(tl: Timeline): { at: number; kind: "pop-mine" | "pop" | "tick" }[] {
  const out: { at: number; kind: "pop-mine" | "pop" | "tick" }[] = [];
  for (const line of tl.lines) {
    if (line.compose) {
      // stesso calcolo di typedCount: la lettera n compare a typeStart + n/totale della durata
      const total = [...line.text].length;
      const dur = line.compose.typeEnd - line.compose.typeStart;
      for (let n = 1; n <= total; n++) out.push({ at: line.compose.typeStart + (n / total) * dur, kind: "tick" });
    }
    out.push({ at: line.at, kind: line.from === "io" ? "pop-mine" : "pop" });
  }
  return out;
}

async function renderAudio(tl: Timeline): Promise<AudioBuffer> {
  const ac = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * tl.duration), SAMPLE_RATE);
  for (const s of chatSounds(tl)) {
    if (s.kind === "tick") playTick(ac, [ac.destination], s.at);
    else playPop(ac, [ac.destination], s.at, s.kind === "pop-mine");
  }
  return ac.startRendering();
}

/** Il browser sa creare MP4 da solo? (Chrome, Edge, Safari recenti) */
export function canEncodeVideo(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof OfflineAudioContext !== "undefined";
}

export async function encodeMeme(opts: {
  script: MemeScript;
  tl: Timeline;
  botName: string;
  withSound: boolean;
  onProgress: (p: number) => void;
}): Promise<Blob> {
  const { script, tl, botName } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: W, height: H });
  if (!videoCodec) throw new Error("Questo browser non sa creare video: usa Chrome o Safari aggiornati.");
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: FPS });

  let audio: AudioBufferSource | null = null;
  if (opts.withSound) {
    const audioCodec = await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 1, sampleRate: SAMPLE_RATE });
    if (audioCodec) {
      audio = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH });
      output.addAudioTrack(audio);
    }
  }

  await output.start();
  const audioDone = audio ? renderAudio(tl).then((buf) => audio!.add(buf)) : Promise.resolve();

  const frames = Math.ceil(tl.duration * FPS);
  for (let i = 0; i < frames; i++) {
    drawFrame(ctx, script, tl, i / FPS, { botName });
    await video.add(i / FPS, 1 / FPS);
    if (i % 15 === 0) {
      opts.onProgress(i / frames);
      await new Promise((r) => setTimeout(r, 0)); // lascia respirare la pagina
    }
  }
  await audioDone;
  await output.finalize();
  opts.onProgress(1);
  const buffer = (output.target as BufferTarget).buffer!;
  return new Blob([buffer], { type: "video/mp4" });
}
