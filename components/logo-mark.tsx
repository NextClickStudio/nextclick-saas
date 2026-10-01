// Marchio Yeppo: una "Y" che converge in un punto (il prospect trovato) + segnale.
import { useId } from "react";

export default function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M18 17 L32 33 L46 17" fill="none" stroke="#05060a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 33 L32 45" fill="none" stroke="#05060a" strokeWidth="7" strokeLinecap="round" />
      <circle cx="46" cy="45" r="4.5" fill="#05060a" />
    </svg>
  );
}
