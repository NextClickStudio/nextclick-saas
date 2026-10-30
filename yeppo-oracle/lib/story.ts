import { short, usd } from "./format";
import type { Kind, TickRow } from "./types";

export type StoryTone = "up" | "down" | "info" | "gold";
export type StoryEvent = { id: string; t: number; icon: string; text: string; tone: StoryTone; who?: string };

/** turns a coin's trades into the few moments worth telling, as they happen */
export class Story {
  private ath = 0;
  private athAt = 0;
  private buys: number[] = [];
  private burstAt = 0;
  private lastT = 0;
  private quietSaid = 0;
  private seen = new Set<string>();
  constructor(
    private dev: string | null,
    private tags: () => Record<string, Kind> | null,
    private solUsd: () => number,
  ) {}

  setDev(dev: string | null) {
    this.dev = dev;
  }

  /** feed trades in time order; returns the new moments, oldest first */
  feed(ticks: TickRow[], replay = false): StoryEvent[] {
    const out: StoryEvent[] = [];
    const say = (t: number, icon: string, text: string, tone: StoryTone, who?: string, key?: string) => {
      const id = key ?? `${t}-${icon}-${who ?? ""}`;
      if (this.seen.has(id)) return;
      this.seen.add(id);
      out.push({ id, t, icon, text, tone, who });
    };
    const tags = this.tags() ?? {};
    for (const [, t, k, solAmt, tok, vsol, vtok, who, sig] of ticks) {
      if (this.seen.has(sig + who + k)) continue;
      this.seen.add(sig + who + k);
      const mc = vtok > 0 ? (vsol / vtok) * 1e9 : 0;
      const share = (tok / 1e9) * 100;
      const kind: Kind | undefined = who === this.dev ? "dev" : tags[who];
      const amt = `${solAmt >= 10 ? solAmt.toFixed(0) : solAmt.toFixed(2)} SOL`;
      const big = solAmt >= 1.5 || share >= 1;
      if (kind === "dev") {
        if (k === 2) say(t, "🚨", `Dev sold ${share.toFixed(1)}% of the supply for ${amt}`, "down", who);
        else say(t, "👤", `Dev bought more: ${amt}`, "info", who);
      } else if (kind === "sniper" && k === 2) say(t, "🎯", `Sniper ${short(who)} sold ${share.toFixed(1)}% (${amt})`, "down", who);
      else if (kind === "smart") {
        if (k === 1 && solAmt >= 0.3) say(t, "🧠", `Smart money ${short(who)} bought ${amt}`, "gold", who);
        else if (big) say(t, "🧠", `Smart money ${short(who)} took profit: ${amt}`, "down", who);
      } else if (kind === "flipper" && k === 1 && big) say(t, "⚡", `Flipper ${short(who)} bought ${amt}. They usually sell within a minute`, "info", who);
      else if (big) {
        if (k === 1) say(t, "🐋", `Whale buy: ${amt} (${share.toFixed(1)}% of the supply)`, "up", who);
        else say(t, "🩸", `Big sell: ${amt} (${share.toFixed(1)}% of the supply)`, "down", who);
      }
      if (k === 1) {
        this.buys.push(t);
        while (this.buys.length && this.buys[0] < t - 5000) this.buys.shift();
        if (this.buys.length >= 8 && t - this.burstAt > 20_000) {
          this.burstAt = t;
          say(t, "🚀", `Buy rush: ${this.buys.length} buys in 5 seconds`, "up", undefined, `burst-${t}`);
        }
      }
      if (mc > this.ath) {
        const wasAth = this.ath;
        this.ath = mc;
        if (wasAth > 0 && mc > wasAth * 1.03 && t - this.athAt > 15_000) {
          this.athAt = t;
          say(t, "📈", `New high: ${usd(mc * this.solUsd())} market cap`, "gold", undefined, `ath-${t}`);
        }
      }
      this.lastT = Math.max(this.lastT, t);
    }
    return replay ? out.slice(-12) : out;
  }

  /** a quiet coin is news too */
  idle(now: number): StoryEvent[] {
    if (!this.lastT || now - this.lastT < 30_000 || this.quietSaid === this.lastT) return [];
    this.quietSaid = this.lastT;
    return [{ id: `quiet-${this.lastT}`, t: now, icon: "🧊", text: "Quiet: no trades for 30 seconds", tone: "info" }];
  }

  setAth(mc: number) {
    if (mc > this.ath) this.ath = mc;
  }
}
