// Marchio Yeppo: "Y" geometrica in gradiente su fondo scuro (vedi lib/brand.ts).
import { useId } from "react";
import { BRAND } from "@/lib/brand";

export default function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="14" y1="15" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND.from} />
          <stop offset="1" stopColor={BRAND.to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={BRAND.bg} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1.5" />
      <path d={BRAND.y} fill={`url(#${id})`} />
    </svg>
  );
}
