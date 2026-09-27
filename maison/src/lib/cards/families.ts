/**
 * Card families. Every trend belongs to one; the family decides the card's look.
 */
export const FAMILIES = ["piece", "shoes", "accessory", "color", "material", "detail", "aesthetic", "beauty"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  piece: "Piece",
  shoes: "Shoes",
  accessory: "Accessory",
  color: "Colour",
  material: "Fabric & Print",
  detail: "Detail",
  aesthetic: "Aesthetic",
  beauty: "Beauty",
};

/** Short plural used in filters and the archive. */
export const FAMILY_PLURAL: Record<Family, string> = {
  piece: "Pieces",
  shoes: "Shoes",
  accessory: "Accessories",
  color: "Colours",
  material: "Fabrics",
  detail: "Details",
  aesthetic: "Aesthetics",
  beauty: "Beauty",
};

/** How a trend is drawn: a colour, a fabric texture or two mood colours. */
export interface TrendStyle {
  hex?: string;
  material?: import("./materials").MaterialSpec & { main: string; accent: string };
  mood?: [string, string];
}
