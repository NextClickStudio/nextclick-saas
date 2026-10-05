// Componenti grafici riusati ovunque (tema scuro, niente librerie esterne).
import Link from "next/link";
import LogoMark from "@/components/logo-mark";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_30px_-8px_rgba(139,123,255,0.6)] hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-[#6ee7d8] px-4 py-2.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-white/[0.08] hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all",
  ghost:
    "inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-40 transition-colors",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors",
};

export const input =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-accent/70 focus:outline-none focus:ring-4 focus:ring-accent/15 transition";

export const label = "block text-sm font-medium text-zinc-300 mb-1.5";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 ${className}`}>{children}</div>;
}

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className={`group flex items-center gap-2.5 font-display font-semibold tracking-tight text-white ${size === "lg" ? "text-xl" : "text-lg"}`}>
      <LogoMark size={size === "lg" ? 34 : 30} className="shadow-[0_0_24px_-6px_rgba(139,123,255,0.6)] rounded-[9px] transition-transform duration-300 group-hover:scale-105" />
      <span className="tracking-[-0.02em]">Yeppo</span>
    </Link>
  );
}

/** Colore del punteggio: rosso (basso) → giallo → verde (alto). */
export function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-400";
  if (score >= 45) return "bg-amber-400";
  return "bg-rose-500";
}

export function ScoreBar({ value, max = 100, className = "" }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div className={`h-full rounded-full ${scoreColor(pct)}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-6 py-12 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "green" | "amber" | "red" }) {
  const tones = {
    neutral: "bg-white/[0.06] text-zinc-300 border-white/10",
    accent: "bg-accent-soft text-[#c4b8ff] border-accent/30",
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    amber: "bg-amber-400/10 text-amber-200 border-amber-400/25",
    red: "bg-red-500/10 text-red-300 border-red-500/25",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
