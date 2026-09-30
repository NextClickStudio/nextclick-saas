// Piccoli componenti grafici riusati ovunque (niente librerie esterne).
import Link from "next/link";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  ghost:
    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 transition-colors",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors",
};

export const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const label = "block text-sm font-medium text-gray-800 mb-1";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`}>{children}</div>;
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-950">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white text-sm">Z</span>
      Zeppo
    </Link>
  );
}

/** Colore del punteggio: rosso (basso) → giallo → verde (alto). */
export function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-400";
  return "bg-rose-500";
}

export function ScoreBar({ value, max = 100, className = "" }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-gray-100 ${className}`}>
      <div className={`h-full rounded-full ${scoreColor(pct)}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-gray-600">
      {children}
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</div>;
}
