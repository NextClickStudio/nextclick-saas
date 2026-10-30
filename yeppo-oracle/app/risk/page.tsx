import type { Metadata } from "next";
import Doc from "@/components/Doc";

export const metadata: Metadata = { title: "Risk disclosure · yeppo" };

export default function Page() {
  return (
    <Doc title="Risk disclosure" updated="30 October 2026">
      <p>
        <b>Memecoins are among the riskiest things you can buy.</b> Most of them lose almost all of their value, often within minutes of launch. You can
        lose all the money you put in. Only trade money you can afford to lose completely.
      </p>
      <h2>What yeppo&apos;s numbers mean</h2>
      <p>
        Verdicts, odds, scores and exit plans come from how similar coins behaved in the past. They describe the past, not the future. A coin can do the
        opposite of what its look-alikes did. A &quot;Runner potential&quot; coin can crash, and a plan that worked on past coins can lose money on yours.
      </p>
      <h2>What yeppo cannot see</h2>
      <p>
        Private deals, coordinated groups, insiders, off-chain promotions and new tricks that never happened before. Data can also be late or missing
        when public nodes are slow.
      </p>
      <h2>Prices move faster than any tool</h2>
      <p>
        On a bonding curve a price can halve in seconds. Stops and targets are levels to act on, not orders: yeppo does not execute them, and by the
        time you click, the price may be far from the level.
      </p>
      <h2>Your limits are yours to keep</h2>
      <p>
        The Safety Net reminds you of the limits you set. It cannot stop you from trading. Keeping to them is up to you.
      </p>
      <h2>No advice</h2>
      <p>yeppo does not give financial advice and does not know your situation. If you are unsure, do not trade.</p>
    </Doc>
  );
}
