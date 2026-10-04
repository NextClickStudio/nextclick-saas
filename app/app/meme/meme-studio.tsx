"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, copyText } from "@/components/client-utils";
import { btn, Card, input, label } from "@/components/ui";
import { buildTimeline, formatCue, parseScript, scriptToText, type MemeScript, type Timeline } from "@/lib/meme-script";
import { drawFrame, H, W } from "./draw";

const STORAGE_KEY = "yeppo-memes-v1";

const EXAMPLE = `POV: chiedi al bro come trovare lead
io: fra come trovo dei lead
bro: in ferramenta
io: no i LEAD
bro: il piombo fra. 3€ al chilo [vine boom]
io: i clienti bro
bro: ah. no quelli non li vendono [metal pipe]`;

type Item = { id: string; text: string };

const newId = () => Math.random().toString(36).slice(2, 10);

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "meme"
  );
}

/** Formato video migliore registrabile da questo browser (mp4 dove possibile). */
function pickMime(): string {
  const options = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** "Pop" sintetico all'arrivo di ogni messaggio (nessun audio esterno, nessun diritto). */
function pop(ac: AudioContext, outs: AudioNode[], mine: boolean) {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(mine ? 900 : 650, t);
  osc.frequency.exponentialRampToValueAtTime(mine ? 1500 : 1100, t + 0.06);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(gain);
  for (const o of outs) gain.connect(o);
  osc.start(t);
  osc.stop(t + 0.14);
}

function loadSaved(): Item[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(saved) && saved.length) return saved.filter((i) => typeof i?.text === "string" && typeof i?.id === "string");
  } catch {}
  return [{ id: "esempio", text: EXAMPLE }];
}

const noop = () => () => {};

/** Lo studio usa canvas e copioni salvati nel browser: lo mostro solo lato client. */
export default function MemeStudio() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  return isClient ? <Studio /> : <p className="text-sm text-zinc-500">Carico lo studio…</p>;
}

function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const [items, setItems] = useState<Item[]>(loadSaved);
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");
  const [speed, setSpeed] = useState(1);
  const [withPop, setWithPop] = useState(true);
  const [botName, setBotName] = useState("bro");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id in riproduzione/registrazione
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // copioni salvati nel browser (comodità: non li perdi se ricarichi)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  // primo fotogramma del primo copione
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || busy || !items[0]) return;
    const s = parseScript(items[0].text);
    const tl = buildTimeline(s, speed);
    drawFrame(ctx, s, tl, tl.chatEnd - 0.01, { botName });
  }, [items, speed, botName, busy]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const avoid = items.map((i) => parseScript(i.text).pov).filter(Boolean).slice(-60);
      const { memes } = await api<{ memes: MemeScript[] }>("/api/app/meme", { body: { count, topic, avoid } });
      setItems((prev) => [...memes.map((m) => ({ id: newId(), text: scriptToText(m) })), ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  /** Riproduce il copione sul canvas; se record=true restituisce il video. */
  function play(item: Item, record: boolean): Promise<Blob | null> {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const script = parseScript(item.text);
    const tl: Timeline = buildTimeline(script, speed);
    const ac = withPop ? new AudioContext() : null;
    const dest = ac?.createMediaStreamDestination() ?? null;
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    const mime = pickMime();

    if (record) {
      const stream = canvas.captureStream(30);
      if (dest) stream.addTrack(dest.stream.getAudioTracks()[0]);
      recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    }

    return new Promise((resolve) => {
      let raf = 0;
      let played = 0;
      let stopped = false;
      const start = performance.now();
      const finish = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(raf);
        const done = () => {
          ac?.close().catch(() => {});
          resolve(record && chunks.length ? new Blob(chunks, { type: (mime || "video/webm").split(";")[0] }) : null);
        };
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = done;
          recorder.stop();
        } else done();
      };
      stopRef.current = finish;
      const frame = () => {
        const t = (performance.now() - start) / 1000;
        while (played < tl.lines.length && t >= tl.lines[played].at) {
          if (ac) pop(ac, record && dest ? [ac.destination, dest] : [ac.destination], tl.lines[played].from === "io");
          played++;
        }
        drawFrame(ctx, script, tl, Math.min(t, tl.duration), { botName });
        if (t >= tl.duration) return finish();
        raf = requestAnimationFrame(frame);
      };
      recorder?.start(250);
      raf = requestAnimationFrame(frame);
    });
  }

  async function preview(item: Item) {
    setBusy(item.id);
    setError("");
    await play(item, false);
    setBusy(null);
  }

  async function download(list: Item[]) {
    if (typeof MediaRecorder === "undefined") {
      setError("Questo browser non può registrare video: usa Chrome o Safari aggiornati.");
      return;
    }
    setError("");
    for (const [i, item] of list.entries()) {
      setBusy(item.id);
      setStatus(`Registro ${i + 1}/${list.length}… tieni questa scheda aperta e in primo piano`);
      const blob = await play(item, true);
      if (!blob) continue;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `yeppo-${slug(parseScript(item.text).pov)}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }
    setBusy(null);
    setStatus(pickMime().includes("mp4") ? "" : "Video salvati in .webm: CapCut li apre, oppure convertili in mp4 prima di caricarli.");
  }

  const update = (id: string, text: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className={label}>Tema (facoltativo)</label>
              <input className={input} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="es. preventivi, linkedin, clienti che non pagano" />
            </div>
            <div>
              <label className={label}>Quanti</label>
              <select className={input} value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 3, 5, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>Nome in chat</label>
              <input className={input} value={botName} maxLength={20} onChange={(e) => setBotName(e.target.value)} />
            </div>
            <div>
              <label className={label}>Ritmo</label>
              <select className={input} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.8}>Lento</option>
                <option value={1}>Normale</option>
                <option value={1.3}>Veloce</option>
              </select>
            </div>
            <label className="flex items-end gap-2 pb-3 text-sm text-zinc-300">
              <input type="checkbox" checked={withPop} onChange={(e) => setWithPop(e.target.checked)} /> &quot;pop&quot; dei messaggi
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn.accent} onClick={generate} disabled={generating || Boolean(busy)}>
              {generating ? "L'AI scrive i copioni…" : `✨ Genera ${count} copioni`}
            </button>
            <button className={btn.secondary} onClick={() => download(items)} disabled={Boolean(busy) || items.length === 0}>
              ⬇ Scarica tutti ({items.length})
            </button>
            <button className={btn.ghost} onClick={() => setItems((p) => [{ id: newId(), text: "POV: \nio: \nbro: " }, ...p])} disabled={Boolean(busy)}>
              + Copione vuoto
            </button>
          </div>
          {status && <p className="text-sm text-cyan">{status}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </Card>

        {items.map((item) => {
          const tl = buildTimeline(parseScript(item.text), speed);
          const cues = tl.cues.map((c) => `${formatCue(c.at)}  🔊 ${c.sfx}  — "${c.text}"`).join("\n");
          return (
            <Card key={item.id} className={`space-y-3 ${busy === item.id ? "border-accent/60" : ""}`}>
              <textarea
                className={`${input} min-h-[190px] font-mono text-[13px] leading-6`}
                value={item.text}
                onChange={(e) => update(item.id, e.target.value)}
                disabled={busy === item.id}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button className={btn.secondary} onClick={() => preview(item)} disabled={Boolean(busy)}>▶ Anteprima</button>
                <button className={btn.primary} onClick={() => download([item])} disabled={Boolean(busy)}>⬇ Scarica video</button>
                {busy === item.id && <button className={btn.ghost} onClick={() => stopRef.current()}>■ Stop</button>}
                <span className="text-xs text-zinc-500">{tl.duration.toFixed(1)} s</span>
                <button className={`${btn.ghost} ml-auto`} onClick={() => remove(item.id)} disabled={busy === item.id}>Elimina</button>
              </div>
              {cues && (
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                    <span>Dove mettere i suoni</span>
                    <button className="hover:text-white" onClick={() => copyText(cues)}>Copia</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs leading-5 text-zinc-300">{cues}</pre>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <canvas ref={canvasRef} width={W} height={H} className="mx-auto w-full max-w-[340px] rounded-2xl border border-white/10" />
        <p className="mt-3 text-xs text-zinc-500">
          Formato testo: <code>io:</code>, <code>bro:</code> o <code>yeppo:</code> a inizio riga, il suono tra [parentesi quadre] in fondo. La registrazione va in
          tempo reale: lascia la scheda aperta finché scarica.
        </p>
      </div>
    </div>
  );
}
