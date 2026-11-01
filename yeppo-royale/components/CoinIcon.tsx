import type { Codename } from "@/lib/codename";

/** Monogram tile for a coin, tinted by its codename hue. */
export default function CoinIcon({ nm, size }: { nm: Codename | null | undefined; size?: number }) {
  const h = nm?.hue ?? 210;
  return (
    <div
      className="coin-ico mono"
      style={{
        background: `hsl(${h} 45% 14%)`,
        color: `hsl(${h} 85% 68%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 50% 24%)`,
        fontWeight: 700,
        fontSize: size ? Math.round(size * 0.36) : undefined,
        width: size,
        height: size,
      }}
    >
      {(nm?.ticker ?? "??").slice(0, 2)}
    </div>
  );
}
