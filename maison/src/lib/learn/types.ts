import type { MaterialSpec } from "@/lib/cards/materials";

/** Something drawn instead of written: a colour, a fabric swatch, a mood. */
export type Visual =
  | { kind: "color"; hex: string }
  | { kind: "pattern"; material: MaterialSpec & { main: string; accent: string } }
  | { kind: "mood"; colors: [string, string] };

export type Option = string | Visual;

export type Question =
  | { type: "choice"; prompt: string; visual?: Visual; options: Option[]; answer: number; explain?: string }
  | { type: "truefalse"; prompt: string; answer: boolean; explain?: string }
  | { type: "pairs"; prompt: string; pairs: [Option, string][] }
  | { type: "order"; prompt: string; items: string[]; explain?: string }
  /** Real market data, built when the lesson starts. */
  | { type: "live"; mode: "higher" | "direction" };

export interface Lesson {
  id: string;
  unit: string;
  title: string;
  questions: Question[];
}

export interface Unit {
  id: string;
  title: string;
  blurb: string;
  color: string;
  ink: string;
  lessons: Lesson[];
}
