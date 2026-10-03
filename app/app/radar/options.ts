// Opzioni del Radar usate dal browser (nessun segreto).
export type RadarProfileInput = { sectors: string[]; topics: string[]; roles: string[]; platforms: string[]; country: string };

export const RADAR_PLATFORM_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "reddit", label: "Reddit" },
];
