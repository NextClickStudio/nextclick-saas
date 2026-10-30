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
        &quot;Momentum&quot;, &quot;Wait&quot; and &quot;Don&apos;t buy&quot; sum up facts yeppo can see: safety checks, the creator&apos;s past
        coins and the last few minutes of trading. They describe what happened, not what will happen. A coin with Momentum can crash a second later, and a
        creator with a clean record can rug this time.
      </p>
      <h2>What yeppo cannot see</h2>
      <p>
        Private deals, coordinated groups, insiders, off-chain promotions and new tricks that never happened before. Data can also be late or missing
        when public nodes are slow.
      </p>
      <h2>Prices move faster than any tool</h2>
      <p>
        On a bonding curve a price can halve in seconds. A creator&apos;s usual selling moment is a habit, not a promise: they can sell earlier.
        yeppo does not trade for you, and by the time you click, the price may have moved.
      </p>
      <h2>No advice</h2>
      <p>yeppo does not give financial advice and does not know your situation. If you are unsure, do not trade.</p>
    </Doc>
  );
}
