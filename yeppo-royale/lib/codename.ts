// During a match every coin wears a codename, so nobody can look the real coin up.
// The real name is revealed in the results.
import { pick, rng } from "./rng";

const ADJ = [
  "Baby", "Based", "Giga", "Turbo", "Mega", "Tiny", "Sad", "Angry", "Golden", "Cyber", "Space", "Rich", "Lazy", "Hyper",
  "Dark", "Pixel", "Retro", "Wild", "Super", "Holy", "Sleepy", "Chad", "Smol", "Laser", "Moon", "Neon", "Ninja", "Royal",
];
const NOUN: [string, string][] = [
  ["Frog", "🐸"], ["Cat", "🐱"], ["Dog", "🐶"], ["Goblin", "👺"], ["Hamster", "🐹"], ["Penguin", "🐧"], ["Monkey", "🐵"],
  ["Whale", "🐳"], ["Duck", "🦆"], ["Wizard", "🧙"], ["Rocket", "🚀"], ["Banana", "🍌"], ["Pickle", "🥒"], ["Toad", "🐊"],
  ["Otter", "🦦"], ["Gecko", "🦎"], ["Llama", "🦙"], ["Moose", "🫎"], ["Panda", "🐼"], ["Rat", "🐀"], ["Bear", "🐻"],
  ["Bull", "🐂"], ["Unicorn", "🦄"], ["Dragon", "🐉"], ["Robot", "🤖"], ["Alien", "👽"], ["Ghost", "👻"], ["Pizza", "🍕"],
  ["Taco", "🌮"], ["Shark", "🦈"], ["Owl", "🦉"], ["Fox", "🦊"], ["Snail", "🐌"], ["Bee", "🐝"], ["Cactus", "🌵"], ["Donut", "🍩"],
];
const HUES = [150, 190, 210, 265, 300, 330, 20, 45, 95];

export type Codename = { name: string; ticker: string; emoji: string; hue: number };

export function codename(matchId: string, ci: number): Codename {
  const r = rng(`${matchId}:${ci}`);
  const a = pick(r, ADJ);
  const [n, emoji] = pick(r, NOUN);
  const style = r();
  const ticker = (style < 0.4 ? n : style < 0.75 ? a[0] + n : a.slice(0, 2) + n.slice(0, 3)).toUpperCase().slice(0, 7);
  return { name: `${a} ${n}`, ticker, emoji, hue: pick(r, HUES) };
}
