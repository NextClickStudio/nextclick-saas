// Animazione dell'hero: Yeppo "scansiona" i siti e assegna i punteggi.
const ROWS = [
  { name: "atelier-milano.it", score: 34, channel: "Instagram DM", tone: "bg-rose-500" },
  { name: "nordicshoes.com", score: 81, channel: "Chat sul sito", tone: "bg-emerald-400" },
  { name: "lunabeauty.it", score: 27, channel: "WhatsApp", tone: "bg-rose-500" },
  { name: "vinoeterra.shop", score: 56, channel: "Pagina partner", tone: "bg-amber-400" },
  { name: "casa-design.it", score: 42, channel: "LinkedIn", tone: "bg-amber-400" },
];

export default function Scanner() {
  return (
    <div className="glow-border relative overflow-hidden rounded-3xl bg-panel/90 p-5 shadow-[0_40px_120px_-30px_rgba(139,123,255,0.45)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="pulse-dot h-2 w-2 rounded-full bg-cyan" />
          <span className="text-xs font-medium text-zinc-300">Sessione live · Moda e accessori</span>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">30 siti · 6 criteri</span>
      </div>
      <div className="relative space-y-2.5">
        {/* linea di scansione */}
        <div className="scanline pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-transparent via-accent/25 to-transparent" />
        {ROWS.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] font-mono text-[11px] text-zinc-400">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">{r.name}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`bar-fill h-full rounded-full ${r.tone}`} style={{ width: `${r.score}%`, animationDelay: `${300 + i * 350}ms` }} />
              </div>
            </div>
            <div className="hidden w-28 text-right sm:block">
              <p className="text-[11px] text-zinc-500">contatto</p>
              <p className="truncate text-xs text-[#c4b8ff]">{r.channel}</p>
            </div>
            <span className="w-9 text-right font-display text-lg font-semibold tabular-nums text-white">{r.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-accent-soft px-3.5 py-2.5 text-xs">
        <span className="text-[#d6ceff]">3 prospect con il sintomo forte · report pronti</span>
        <span className="font-mono text-zinc-400">→</span>
      </div>
    </div>
  );
}
