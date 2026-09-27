/** Small line icons (no emoji anywhere in the app). */
export function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.7 4.5c2.2 0 3.7 1.3 4.6 2.7h1.4c.9-1.4 2.4-2.7 4.6-2.7 3.7 0 5.9 3.7 4.3 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function Flame({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.5 2c.6 3.6-2.6 5.6-2.6 9.1 0 1.4.8 2.4 2 2.4 1.3 0 2-1 2-2.4 0-.8-.2-1.4-.5-2 2.6 1.2 4.6 4 4.6 7.1A6 6 0 0 1 6 16.2c0-5.3 5.4-7.6 6.5-14.2z" />
    </svg>
  );
}

export function Bolt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.8h-6.6z" />
    </svg>
  );
}

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3 7.5 7.5 11 12 4.5 16.5 11 21 7.5 19.5 18h-15z" />
      <rect x="4.5" y="19" width="15" height="2" rx="1" />
    </svg>
  );
}

export function Lock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
