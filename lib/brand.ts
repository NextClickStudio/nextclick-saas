// Marchio Yeppo in un punto solo: la "Y" geometrica (due bracci che convergono in un'unica direzione).
export const BRAND = {
  bg: "#0c0d16",
  from: "#a594ff",
  to: "#5eead4",
  // Y piena con tagli orizzontali, bracci paralleli: leggibile anche a 16 px
  y: "M14 15H24L32 25L40 15H50L36.5 32V50H27.5V32Z",
};

/** SVG del marchio come stringa (favicon, immagini generate). */
export function markSvg(size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="14" y1="15" x2="50" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${BRAND.from}"/><stop offset="1" stop-color="${BRAND.to}"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="${BRAND.bg}"/><rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5"/><path d="${BRAND.y}" fill="url(#g)"/></svg>`;
}
