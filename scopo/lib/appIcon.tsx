import { ImageResponse } from "next/og";

/**
 * Icona dell'app come PNG (per iPhone e per il manifest), disegnata al volo.
 * `padding` > 0 lascia margine per le icone "maskable" di Android.
 */
export function appIcon(size: number, padding = 0) {
  const inner = size - padding * 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #c6ff3d 0%, #38f3e0 100%)",
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="15" fill="none" stroke="#07070c" strokeWidth="5" />
          <path d="M32 7v8M32 49v8M7 32h8M49 32h8" stroke="#07070c" strokeWidth="5" strokeLinecap="round" />
          <path d="M28.5 25.5l10 6.5-10 6.5z" fill="#07070c" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
