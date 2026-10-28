import { BGS, FACES, normLook, type Look } from "@/lib/avatar";

// Flat, minimal profile picture: a tilted rounded face on a dark tone, thin details.
// Drawn in a 64x64 box so it stays crisp from 18px to 160px.

const INK = "#0b0c0e";

function Eyes({ v }: { v: number }) {
  const L = 25;
  const R = 39;
  const Y = 30;
  switch (v) {
    case 1:
      return (
        <g fill={INK}>
          <circle cx={L} cy={Y} r={3.2} />
          <circle cx={R} cy={Y} r={3.2} />
          <circle cx={L + 1} cy={Y - 1} r={1} fill="#fff" />
          <circle cx={R + 1} cy={Y - 1} r={1} fill="#fff" />
        </g>
      );
    case 2:
      return <path d={`M${L - 3} ${Y} h6 M${R - 3} ${Y} h6`} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
    case 3:
      return <path d={`M${L - 3} ${Y + 1} q3 -3 6 0 M${R - 3} ${Y + 1} q3 -3 6 0`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
    case 4:
      return (
        <g fill={INK}>
          <circle cx={L} cy={Y} r={2} />
          <circle cx={R} cy={Y} r={2} />
          <path d={`M${L - 3.5} ${Y - 4} l6 1.5 M${R + 3.5} ${Y - 4} l-6 1.5`} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      );
    case 5:
      return (
        <g fill={INK}>
          <rect x={L - 2.2} y={Y - 2.2} width={4.4} height={4.4} rx={0.8} />
          <rect x={R - 2.2} y={Y - 2.2} width={4.4} height={4.4} rx={0.8} />
        </g>
      );
    case 6:
      return (
        <g fill={INK}>
          <path d={`M${L} ${Y - 3.5} l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z`} />
          <path d={`M${R} ${Y - 3.5} l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z`} />
        </g>
      );
    case 7:
      return <path d={`M${L - 3} ${Y + 1.5} l3 -3 3 3 M${R - 3} ${Y + 1.5} l3 -3 3 3`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    default:
      return (
        <g fill={INK}>
          <circle cx={L} cy={Y} r={2.2} />
          <circle cx={R} cy={Y} r={2.2} />
        </g>
      );
  }
}

function Mouth({ v }: { v: number }) {
  const st = { stroke: INK, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const };
  switch (v) {
    case 1:
      return <path d="M27 39 q5 4 10 0" {...st} />;
    case 2:
      return <ellipse cx={32} cy={40} rx={2.6} ry={3} fill={INK} />;
    case 3:
      return <path d="M28 40 q5 2 9 -2" {...st} />;
    case 4:
      return <path d="M25 39 q7 5 14 0 z" fill={INK} />;
    case 5:
      return <circle cx={32} cy={40} r={1.6} fill={INK} />;
    case 6:
      return (
        <g>
          <path d="M26 38 h12 q-1 5 -6 5 q-5 0 -6 -5z" fill={INK} />
          <path d="M27.5 38.8 h9" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      );
    case 7:
      return <path d="M27 40 h10" {...st} />;
    default:
      return <path d="M28.5 40 h7" {...st} />;
  }
}

function Eyewear({ v }: { v: number }) {
  switch (v) {
    case 1:
      return (
        <g fill={INK}>
          <rect x={19.5} y={27} width={11} height={6.5} rx={2} />
          <rect x={33.5} y={27} width={11} height={6.5} rx={2} />
          <rect x={30} y={28.5} width={4} height={1.5} />
        </g>
      );
    case 2:
      return (
        <g fill="none" stroke={INK} strokeWidth={1.4}>
          <circle cx={25} cy={30} r={5} />
          <circle cx={39} cy={30} r={5} />
          <path d="M30 30 h4" />
        </g>
      );
    case 3:
      return <rect x={18} y={26.5} width={28} height={7} rx={3.5} fill="#22d3ee" opacity={0.55} stroke={INK} strokeWidth={1.2} />;
    case 4:
      return (
        <g fill="none" stroke="#f0b90b" strokeWidth={1.4}>
          <circle cx={39} cy={30} r={5} />
          <path d="M44 31 q3 6 0 12" strokeWidth={0.9} />
        </g>
      );
    case 5:
      return (
        <g fill={INK}>
          <rect x={18} y={27} width={28} height={2.2} />
          <rect x={20} y={29.2} width={9} height={3} />
          <rect x={35} y={29.2} width={9} height={3} />
        </g>
      );
    default:
      return null;
  }
}

function Top({ v }: { v: number }) {
  switch (v) {
    case 1:
      return (
        <g fill={INK}>
          <path d="M17 19 q15 -12 30 0 v2 h-30z" />
          <path d="M40 20 h12 q-2 3 -12 3z" />
        </g>
      );
    case 2:
      return (
        <g fill={INK}>
          <path d="M17 20 q15 -14 30 0z" />
          <rect x={16} y={18.5} width={32} height={4} rx={2} />
        </g>
      );
    case 3:
      return <path d="M21 19 l2 -9 5 5 4 -7 4 7 5 -5 2 9z" fill="#f0b90b" />;
    case 4:
      return <ellipse cx={32} cy={8} rx={10} ry={2.6} fill="none" stroke="#f0b90b" strokeWidth={1.8} />;
    case 5:
      return (
        <g fill="none" stroke={INK} strokeWidth={2.2}>
          <path d="M13 30 q0 -18 19 -18 q19 0 19 18" />
          <rect x={10} y={27} width={5} height={9} rx={2} fill={INK} />
          <rect x={49} y={27} width={5} height={9} rx={2} fill={INK} />
        </g>
      );
    case 6:
      return (
        <g fill={INK}>
          <path d="M20 17 q-4 -6 -2 -11 q4 5 7 8z" />
          <path d="M44 17 q4 -6 2 -11 q-4 5 -7 8z" />
        </g>
      );
    case 7:
      return <rect x={15} y={19} width={34} height={4} rx={2} fill="#f6465d" />;
    case 8:
      return (
        <g stroke={INK} strokeWidth={1.6}>
          <path d="M32 15 v-7" />
          <circle cx={32} cy={7} r={2.2} fill="#f6465d" stroke="none" />
        </g>
      );
    case 9:
      return <path d="M32 4 l2.2 4.6 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7z" fill="#f0b90b" />;
    default:
      return null;
  }
}

const RINGS = [null, "rgba(255,255,255,0.85)", "#10d48e", "#f0b90b", "#3d8bff", "double", "dashed"] as const;

export default function Avatar({ look, size = 32, className = "" }: { look: unknown; size?: number; className?: string; ring?: string }) {
  const L: Look = normLook(look);
  const face = FACES[L.s];
  const bg = BGS[L.b];
  const ring = RINGS[L.o];
  const tilt = ((L.e * 7 + L.m * 3) % 13) - 6;
  return (
    <svg className={`avatar ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-hidden>
      <circle cx={32} cy={32} r={32} fill={bg} />
      <g transform={`rotate(${tilt} 32 36)`}>
        <rect x={14} y={14} width={36} height={40} rx={13} fill={face} />
        <Eyes v={L.e} />
        <Mouth v={L.m} />
        <Eyewear v={L.g} />
        <Top v={L.h} />
      </g>
      {ring === "double" ? (
        <>
          <circle cx={32} cy={32} r={30.5} fill="none" stroke="#10d48e" strokeWidth={1.6} />
          <circle cx={32} cy={32} r={27.5} fill="none" stroke="#3d8bff" strokeWidth={1.2} />
        </>
      ) : ring === "dashed" ? (
        <circle cx={32} cy={32} r={30.5} fill="none" stroke="#e6e8eb" strokeWidth={1.6} strokeDasharray="4 3" />
      ) : ring ? (
        <circle cx={32} cy={32} r={30.5} fill="none" stroke={ring} strokeWidth={2} />
      ) : null}
    </svg>
  );
}
