/** A maison's monogram tile, drawn in its own palette. */
export function Monogram({ house, size = 44 }: { house: { monogram: string; palette: string[] }; size?: number }) {
  const [bg, ring, ink] = house.palette;
  return (
    <span
      className="grid shrink-0 place-items-center font-black tracking-tight"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        color: ink,
        boxShadow: `inset 0 0 0 ${Math.max(2, size / 22)}px ${ring}`,
        fontSize: size * (house.monogram.length > 2 ? 0.32 : 0.4),
      }}
    >
      {house.monogram}
    </span>
  );
}
