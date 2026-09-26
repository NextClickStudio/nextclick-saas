/**
 * Checks that the same seed always draws the same garment.
 * Run: npm run check:determinism
 */
import { RARITIES } from "../src/config/game";
import { generateGarment } from "../src/lib/garment/generate";
import { renderGarmentSvg } from "../src/lib/garment/render";
import { GARMENT_TYPES } from "../src/lib/garment/types";

let failures = 0;
let count = 0;
for (let i = 0; i < 300; i++) {
  const type = i % 3 === 0 ? GARMENT_TYPES[i % GARMENT_TYPES.length] : undefined;
  const rarity = i % 2 === 0 ? RARITIES[i % RARITIES.length] : undefined;
  const a = renderGarmentSvg(generateGarment(`check-${i}`, { type, rarity }));
  const b = renderGarmentSvg(generateGarment(`check-${i}`, { type, rarity }));
  count++;
  if (a !== b) {
    failures++;
    console.error(`Seed check-${i} is not deterministic`);
  }
  if (a.includes("NaN") || a.includes("undefined")) {
    failures++;
    console.error(`Seed check-${i} produced an invalid drawing`);
  }
}
console.log(`${count} garments checked, ${failures} problems`);
process.exit(failures ? 1 : 0);
