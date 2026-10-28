import { useId } from "react";
import { BGS, SKINS, normLook, type Look } from "@/lib/avatar";

// The "trencher": a bean-shaped character drawn in a 120x120 box.
// Every part is plain SVG so it renders crisp at any size.

const INK = "#14151c";

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function Eyes({ v, skin }: { v: number; skin: string }) {
  const L = 46;
  const R = 74;
  const Y = 60;
  switch (v) {
    case 1: // happy
      return (
        <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
          <path d={`M${L - 7} ${Y + 2} Q${L} ${Y - 7} ${L + 7} ${Y + 2}`} />
          <path d={`M${R - 7} ${Y + 2} Q${R} ${Y - 7} ${R + 7} ${Y + 2}`} />
        </g>
      );
    case 2: // laser
      return (
        <g>
          <path d={`M${L} ${Y} L-10 ${Y + 18} L-10 ${Y + 6} Z M${R} ${Y} L130 ${Y + 18} L130 ${Y + 6} Z`} fill="#ff2d55" opacity={0.55} />
          <circle cx={L} cy={Y} r={7} fill="#fff" />
          <circle cx={R} cy={Y} r={7} fill="#fff" />
          <circle cx={L} cy={Y} r={4.5} fill="#ff2d55" />
          <circle cx={R} cy={Y} r={4.5} fill="#ff2d55" />
        </g>
      );
    case 3: // sleepy
      return (
        <g>
          <circle cx={L} cy={Y} r={7} fill="#fff" />
          <circle cx={R} cy={Y} r={7} fill="#fff" />
          <circle cx={L} cy={Y + 2} r={3.5} fill={INK} />
          <circle cx={R} cy={Y + 2} r={3.5} fill={INK} />
          <path d={`M${L - 8} ${Y} A8 8 0 0 1 ${L + 8} ${Y} Z M${R - 8} ${Y} A8 8 0 0 1 ${R + 8} ${Y} Z`} fill={shade(skin, -0.12)} />
          <path d={`M${L - 8} ${Y} H${L + 8} M${R - 8} ${Y} H${R + 8}`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 4: // angry
      return (
        <g>
          <circle cx={L} cy={Y + 1} r={6.5} fill="#fff" />
          <circle cx={R} cy={Y + 1} r={6.5} fill="#fff" />
          <circle cx={L + 1} cy={Y + 2} r={3.4} fill={INK} />
          <circle cx={R - 1} cy={Y + 2} r={3.4} fill={INK} />
          <path d={`M${L - 9} ${Y - 9} L${L + 7} ${Y - 4} M${R + 9} ${Y - 9} L${R - 7} ${Y - 4}`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 5: // stars
      return (
        <g fill="#ffd400" stroke={INK} strokeWidth={1.5} strokeLinejoin="round">
          {[L, R].map((x) => (
            <path key={x} d={`M${x} ${Y - 9} L${x + 2.6} ${Y - 2.6} L${x + 9} ${Y - 2} L${x + 4} ${Y + 2.4} L${x + 5.6} ${Y + 9} L${x} ${Y + 5.2} L${x - 5.6} ${Y + 9} L${x - 4} ${Y + 2.4} L${x - 9} ${Y - 2} L${x - 2.6} ${Y - 2.6} Z`} />
          ))}
        </g>
      );
    case 6: // money
      return (
        <g>
          <circle cx={L} cy={Y} r={8} fill="#fff" />
          <circle cx={R} cy={Y} r={8} fill="#fff" />
          <text x={L} y={Y + 5} textAnchor="middle" fontSize={14} fontWeight={900} fill="#0fa36b" fontFamily="Arial">$</text>
          <text x={R} y={Y + 5} textAnchor="middle" fontSize={14} fontWeight={900} fill="#0fa36b" fontFamily="Arial">$</text>
        </g>
      );
    case 7: // wide
      return (
        <g>
          <circle cx={L} cy={Y} r={9.5} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={R} cy={Y} r={9.5} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={L + 1} cy={Y + 1} r={2.6} fill={INK} />
          <circle cx={R - 1} cy={Y + 1} r={2.6} fill={INK} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={L} cy={Y} r={7} fill="#fff" />
          <circle cx={R} cy={Y} r={7} fill="#fff" />
          <circle cx={L + 1} cy={Y + 1} r={3.8} fill={INK} />
          <circle cx={R + 1} cy={Y + 1} r={3.8} fill={INK} />
          <circle cx={L + 2.4} cy={Y - 0.6} r={1.3} fill="#fff" />
          <circle cx={R + 2.4} cy={Y - 0.6} r={1.3} fill="#fff" />
        </g>
      );
  }
}

function Mouth({ v }: { v: number }) {
  const Y = 80;
  const st = { fill: "none", stroke: INK, strokeWidth: 3.5, strokeLinecap: "round" as const };
  switch (v) {
    case 1:
      return (
        <g>
          <path d={`M46 ${Y - 3} Q60 ${Y + 16} 74 ${Y - 3} Z`} fill={INK} />
          <path d={`M49 ${Y - 2} Q60 ${Y + 4} 71 ${Y - 2} Z`} fill="#fff" />
        </g>
      );
    case 2:
      return <path d={`M50 ${Y + 1} Q63 ${Y + 6} 72 ${Y - 4}`} {...st} />;
    case 3:
      return <ellipse cx={60} cy={Y + 2} rx={5} ry={6.5} fill={INK} />;
    case 4:
      return (
        <g>
          <path d={`M49 ${Y - 1} Q60 ${Y + 10} 71 ${Y - 1}`} {...st} />
          <path d={`M60 ${Y + 3} q6 1 6 8 q-6 5 -10 -1 q0 -6 4 -7`} fill="#ff6b9a" stroke={INK} strokeWidth={2} />
        </g>
      );
    case 5:
      return <path d={`M51 ${Y + 1} H69`} {...st} />;
    case 6:
      return (
        <g>
          <rect x={47} y={Y - 5} width={26} height={11} rx={3} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <path d={`M53.5 ${Y - 5} V${Y + 6} M60 ${Y - 5} V${Y + 6} M66.5 ${Y - 5} V${Y + 6} M47 ${Y + 0.5} H73`} stroke={INK} strokeWidth={1.6} />
        </g>
      );
    case 7:
      return <path d={`M49 ${Y + 6} Q60 ${Y - 5} 71 ${Y + 6}`} {...st} />;
    default:
      return <path d={`M48 ${Y - 2} Q60 ${Y + 9} 72 ${Y - 2}`} {...st} />;
  }
}

function Eyewear({ v }: { v: number }) {
  const Y = 60;
  switch (v) {
    case 1:
      return (
        <g>
          <path d="M33 54 H87" stroke={INK} strokeWidth={3} />
          <rect x={34} y={53} width={24} height={14} rx={5} fill={INK} />
          <rect x={62} y={53} width={24} height={14} rx={5} fill={INK} />
          <path d="M38 57 l8 0 M66 57 l8 0" stroke="#fff" strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        </g>
      );
    case 2:
      return (
        <g fill={INK}>
          <rect x={32} y={54} width={56} height={4} />
          <rect x={36} y={58} width={20} height={4} />
          <rect x={64} y={58} width={20} height={4} />
          <rect x={40} y={62} width={12} height={4} />
          <rect x={68} y={62} width={12} height={4} />
          <rect x={40} y={58} width={4} height={4} fill="#fff" />
          <rect x={68} y={58} width={4} height={4} fill="#fff" />
        </g>
      );
    case 3:
      return (
        <g fill="none" stroke="#d9a441" strokeWidth={2.5}>
          <circle cx={74} cy={Y} r={10} />
          <path d="M84 62 Q92 80 86 98" strokeWidth={1.5} />
        </g>
      );
    case 4:
      return <rect x={30} y={52} width={60} height={15} rx={7.5} fill="#2fd6ff" opacity={0.55} stroke={INK} strokeWidth={2.5} />;
    case 5:
      return (
        <g stroke="#fff" strokeWidth={2.5}>
          <rect x={35} y={53} width={22} height={14} rx={2} fill="#ff2d55" opacity={0.75} />
          <rect x={63} y={53} width={22} height={14} rx={2} fill="#2fa8ff" opacity={0.75} />
          <path d="M57 58 H63" />
        </g>
      );
    default:
      return null;
  }
}

function Headwear({ v }: { v: number }) {
  switch (v) {
    case 1: // cap
      return (
        <g>
          <path d="M28 40 Q30 14 60 13 Q90 14 92 40 Z" fill="#ff3d57" />
          <path d="M60 40 Q98 36 110 46 Q96 50 60 44 Z" fill="#c81e3a" />
          <circle cx={60} cy={14} r={3} fill="#c81e3a" />
          <path d="M44 22 Q60 18 76 22" stroke="#fff" strokeWidth={3} fill="none" opacity={0.8} />
        </g>
      );
    case 2: // beanie
      return (
        <g>
          <path d="M27 42 Q28 12 60 11 Q92 12 93 42 Z" fill="#4d7bff" />
          <rect x={25} y={34} width={70} height={11} rx={5} fill="#3157c9" />
          <circle cx={60} cy={9} r={7} fill="#fff" />
          <path d="M40 18 V34 M50 14 V34 M60 13 V34 M70 14 V34 M80 18 V34" stroke="#3157c9" strokeWidth={2} />
        </g>
      );
    case 3: // crown
      return (
        <g>
          <path d="M33 38 L36 12 L48 26 L60 8 L72 26 L84 12 L87 38 Z" fill="#ffd400" stroke="#b8860b" strokeWidth={2} strokeLinejoin="round" />
          <circle cx={60} cy={30} r={3.5} fill="#ff2d55" />
          <circle cx={45} cy={32} r={2.5} fill="#2fd6ff" />
          <circle cx={75} cy={32} r={2.5} fill="#38f28c" />
        </g>
      );
    case 4: // cowboy
      return (
        <g>
          <ellipse cx={60} cy={36} rx={52} ry={8} fill="#8a5a2b" />
          <path d="M34 36 Q34 8 60 9 Q86 8 86 36 Z" fill="#a8703a" />
          <path d="M34 30 H86" stroke="#5a3a1a" strokeWidth={5} />
        </g>
      );
    case 5: // headphones
      return (
        <g>
          <path d="M22 62 Q20 18 60 16 Q100 18 98 62" fill="none" stroke={INK} strokeWidth={7} />
          <rect x={12} y={50} width={16} height={26} rx={7} fill="#ff3d57" stroke={INK} strokeWidth={3} />
          <rect x={92} y={50} width={16} height={26} rx={7} fill="#ff3d57" stroke={INK} strokeWidth={3} />
        </g>
      );
    case 6: // top hat
      return (
        <g>
          <rect x={40} y={0} width={40} height={32} rx={3} fill={INK} />
          <rect x={40} y={22} width={40} height={6} fill="#ff3d57" />
          <ellipse cx={60} cy={33} rx={32} ry={6} fill={INK} />
        </g>
      );
    case 7: // horns
      return (
        <g fill="#ff3d57" stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
          <path d="M36 32 Q26 16 30 2 Q40 16 46 26 Z" />
          <path d="M84 32 Q94 16 90 2 Q80 16 74 26 Z" />
        </g>
      );
    case 8: // halo
      return <ellipse cx={60} cy={10} rx={24} ry={6} fill="none" stroke="#ffd400" strokeWidth={4.5} />;
    case 9: // bandana
      return (
        <g>
          <path d="M24 42 Q60 26 96 42 L96 50 Q60 36 24 50 Z" fill="#ff3d57" />
          <path d="M94 44 L110 36 L106 50 Z M94 46 L112 56 L100 58 Z" fill="#c81e3a" />
          <circle cx={45} cy={42} r={1.6} fill="#fff" />
          <circle cx={60} cy={38} r={1.6} fill="#fff" />
          <circle cx={75} cy={42} r={1.6} fill="#fff" />
        </g>
      );
    default:
      return null;
  }
}

function Outfit({ v, skin }: { v: number; skin: string }) {
  switch (v) {
    case 1: // hoodie
      return (
        <g>
          <path d="M18 96 Q60 84 102 96 L104 120 L16 120 Z" fill="#2b2d36" />
          <path d="M34 92 Q60 108 86 92" fill="none" stroke="#454857" strokeWidth={5} />
          <path d="M52 100 V114 M68 100 V114" stroke="#f4f1ea" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 2: // suit
      return (
        <g>
          <path d="M18 98 Q60 88 102 98 L104 120 L16 120 Z" fill="#1b1d2a" />
          <path d="M48 92 L60 120 L72 92 Z" fill="#fff" />
          <path d="M57 98 L60 96 L63 98 L61.5 114 L60 117 L58.5 114 Z" fill="#ff3d57" />
          <path d="M48 92 L56 108 M72 92 L64 108" stroke="#33364a" strokeWidth={3} />
        </g>
      );
    case 3: // gold chain
      return (
        <g>
          <path d="M36 92 Q60 116 84 92" fill="none" stroke="#ffd400" strokeWidth={5} strokeDasharray="5 2.5" />
          <circle cx={60} cy={108} r={8} fill="#ffd400" stroke="#b8860b" strokeWidth={2} />
          <text x={60} y={112} textAnchor="middle" fontSize={11} fontWeight={900} fill="#8a6200" fontFamily="Arial">$</text>
        </g>
      );
    case 4: // jersey
      return (
        <g>
          <path d="M18 98 Q60 88 102 98 L104 120 L16 120 Z" fill="#ffd400" />
          <path d="M44 93 Q60 102 76 93" fill="none" stroke={INK} strokeWidth={3.5} />
          <text x={60} y={117} textAnchor="middle" fontSize={15} fontWeight={900} fill={INK} fontFamily="Arial">100</text>
        </g>
      );
    case 5: // tank top
      return (
        <g>
          <path d="M30 120 L32 96 Q46 106 60 106 Q74 106 88 96 L90 120 Z" fill="#fff" />
          <path d="M32 96 L36 88 M88 96 L84 88" stroke="#fff" strokeWidth={6} strokeLinecap="round" />
        </g>
      );
    case 6: // puffer
      return (
        <g>
          <path d="M16 96 Q60 82 104 96 L106 120 L14 120 Z" fill="#ff9f2e" />
          <path d="M16 106 Q60 96 104 106 M15 114 Q60 104 105 114" stroke="#d97706" strokeWidth={2.5} fill="none" />
          <path d="M60 90 V120" stroke="#d97706" strokeWidth={2.5} />
        </g>
      );
    default:
      return <path d="M24 104 Q60 96 96 104" fill="none" stroke={shade(skin, -0.18)} strokeWidth={3} opacity={0.6} />;
  }
}

export default function Avatar({ look, size = 40, className = "", ring }: { look: unknown; size?: number; className?: string; ring?: string }) {
  const L: Look = normLook(look);
  const id = useId().replace(/:/g, "");
  const skin = SKINS[L.s];
  const [b1, b2] = BGS[L.b];
  return (
    <svg
      className={`avatar ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-hidden
      style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
    >
      <defs>
        <radialGradient id={`bg${id}`} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor={b1} />
          <stop offset="1" stopColor={b2} />
        </radialGradient>
        <linearGradient id={`sk${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(skin, 0.12)} />
          <stop offset="1" stopColor={shade(skin, -0.12)} />
        </linearGradient>
        <clipPath id={`cl${id}`}>
          <rect width="120" height="120" rx="22" />
        </clipPath>
      </defs>
      <g clipPath={`url(#cl${id})`}>
        <rect width="120" height="120" fill={`url(#bg${id})`} />
        <path d="M60 24 C88 24 100 46 100 72 L100 124 L20 124 L20 72 C20 46 32 24 60 24 Z" fill={`url(#sk${id})`} stroke={INK} strokeWidth={3} />
        <ellipse cx={44} cy={40} rx={10} ry={6} fill="#fff" opacity={0.22} transform="rotate(-25 44 40)" />
        <ellipse cx={36} cy={74} rx={5} ry={3.2} fill="#ff6b9a" opacity={0.35} />
        <ellipse cx={84} cy={74} rx={5} ry={3.2} fill="#ff6b9a" opacity={0.35} />
        <Outfit v={L.o} skin={skin} />
        <Eyes v={L.e} skin={skin} />
        <Mouth v={L.m} />
        <Eyewear v={L.g} />
        <Headwear v={L.h} />
      </g>
    </svg>
  );
}
