// "Is it THE coin?": the other pump.fun coins with the same ticker or name launched in the last 2 hours, which one came
// first and which one leads now. Measured on ~60,000 coins (3 Nov 2026): the first coin of a name that gets copied made
// ×5 5.0% of the time and graduated 2.15%, its copies 3.0% and 1.09%, names nobody copied 1.3% and 0.68%.
import type { WaveCoin } from "./wave";
import { isLive } from "./wave";

export type Namesake = {
  mint: string; sym: string | null; t0: number; mcUsd: number | null; hix: number; nowx: number;
  orig: boolean; live: boolean; flag: WaveCoin["flag"]; dead: boolean; me: boolean;
  /** trades so far and buying wallets in the last 2 minutes */
  n: number; w2: number;
};
/** the coin being read, from the read itself: added when the list doesn't have it (a launch yeppo saw late) */
export type Self = { mcUsd: number | null; nowx: number | null; hix: number | null; w2: number | null; n: number | null; live: boolean; t0: number | null };
export type TheCoin = {
  /** the ticker as the list matched it */
  word: string;
  /** coins with this name, this one included */
  total: number;
  meOrig: boolean;
  meBest: boolean;
  /** the coin leading the list: alive, no red flag, the biggest market cap */
  best: Namesake | null;
  orig: Namesake | null;
  /** up to 6 coins, the leader first, this one marked */
  list: Namesake[];
  verdict: string;
  tone: "up" | "mid" | "down";
};

export const nameWord = (sym: string | null) => (sym ?? "").toLowerCase().replace(/^\$/, "").replace(/[^a-z0-9]/g, "");

const usd = (v: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);
/** another coin of the list, told apart from this one by when it launched (they share the ticker) */
const other = (n: Namesake, me: Namesake | null) => `${!me ? "another" : n.t0 < me.t0 ? "an older" : "a newer"} $${(n.sym ?? "?").replace(/^\$/, "")}`;

const HARD = new Set(["rug", "dumped", "farm", "creator"]);
/** a coin that can lead: trading now, real buyers, not crashed from its high, no trap */
const canLead = (c: Namesake) =>
  !c.dead && c.live && (c.n >= 30 || c.w2 >= 3) && (c.hix <= 1.3 || c.nowx >= c.hix * 0.5) && !(c.flag && HARD.has(c.flag));
/** how strongly it leads: its market cap, more with buyers coming in, less with a bundle, snipers or a creator bag */
const leadScore = (c: Namesake) => (c.mcUsd ?? 0) * (1 + Math.min(c.w2, 30) / 15) * (c.flag ? 0.6 : 1);

/** null when no other coin has this name */
export function theCoin(mint: string, sym: string | null, coins: WaveCoin[], self?: Self): TheCoin | null {
  const word = nameWord(sym);
  const all: Namesake[] = coins
    .filter((c) => c.match >= 1)
    .map((c) => ({
      mint: c.mint, sym: c.sym, t0: c.t0, mcUsd: c.mcUsd, hix: c.hix, nowx: c.nowx,
      orig: c.orig, live: isLive(c), flag: c.flag, dead: c.dead, me: c.mint === mint, n: c.n, w2: c.w2,
    }));
  if (all.filter((c) => !c.me).length === 0) return null;
  // the coin being read, when the list missed it
  if (!all.some((c) => c.me) && self?.t0) {
    const firstT = Math.min(...all.map((c) => c.t0));
    all.push({
      mint, sym, t0: self.t0, mcUsd: self.mcUsd, hix: self.hix ?? 1, nowx: self.nowx ?? 1, orig: self.t0 < firstT,
      live: self.live, flag: null, dead: false, me: true, n: self.n ?? 0, w2: self.w2 ?? 0,
    });
    if (self.t0 < firstT) for (const c of all) if (!c.me) c.orig = false;
  }
  const cands = all.filter(canLead).sort((a, b) => leadScore(b) - leadScore(a));
  let best = cands[0] ?? null;
  // this coin, close behind the leader, counts as leading: the list doesn't flip between two coins
  const meC = cands.find((c) => c.me);
  if (best && meC && meC !== best && leadScore(meC) >= leadScore(best) * 0.8) best = meC;
  const orig = all.find((c) => c.orig) ?? [...all].sort((a, b) => a.t0 - b.t0)[0] ?? null;
  const me = all.find((c) => c.me) ?? null;
  const meBest = !!me && best?.mint === me.mint;
  const meOrig = !!me && orig?.mint === me.mint;
  const total = all.length + (me ? 0 : 1);
  const S = `$${(sym ?? word).replace(/^\$/, "").toUpperCase()}`;
  let verdict: string;
  let tone: TheCoin["tone"];
  if (meBest && meOrig) [verdict, tone] = [`THE coin: the original, and it leads all ${total} coins named ${S}.`, "up"];
  else if (meBest) [verdict, tone] = [`Leads all ${total} coins named ${S}${orig ? `, though ${other(orig, me)} came first` : ""}.`, "up"];
  else if (meOrig && best) [verdict, tone] = [`The original, but ${other(best, me)} leads now at ${usd(best.mcUsd)}.`, "mid"];
  else if (best) [verdict, tone] = [`A copy. ${best.orig ? "The original" : other(best, me).replace(/^./, (ch) => ch.toUpperCase())} leads ${total} coins named ${S}: ${usd(best.mcUsd)}, ${best.w2} buyers in 2 min.`, "down"];
  else if (me && canLead(me)) [verdict, tone] = [`${total} coins named ${S}: this is the only one still active.`, "up"];
  else [verdict, tone] = [`${total} coins named ${S}: none is active and holding up.`, "mid"];
  const mc = (c: Namesake) => c.mcUsd ?? 0;
  const list = [...all].sort((a, b) => Number(b.mint === best?.mint) - Number(a.mint === best?.mint) || Number(canLead(b)) - Number(canLead(a)) || Number(a.dead) - Number(b.dead) || mc(b) - mc(a)).slice(0, 6);
  if (me && !list.some((c) => c.me)) list[list.length - 1] = me;
  return { word, total, meOrig, meBest: meBest || (!best && !!me && canLead(me)), best, orig, list, verdict, tone };
}
