type MarkProps = { size?: number; className?: string };

/** Il marchio: un mirino (lo "scopo", il focus) con dentro il play. */
export function LogoMark({ size = 32, className }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="scopo-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c6ff3d" />
          <stop offset="1" stopColor="#38f3e0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#scopo-mark)" />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#07070c" strokeWidth="5" />
      <path d="M32 7v8M32 49v8M7 32h8M49 32h8" stroke="#07070c" strokeWidth="5" strokeLinecap="round" />
      <path d="M28.5 25.5l10 6.5-10 6.5z" fill="#07070c" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">scopo</span>
    </span>
  );
}
