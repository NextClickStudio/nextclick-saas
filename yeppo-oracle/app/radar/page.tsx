import type { Metadata } from "next";
import { Paper } from "@/components/Nav";
import Radar from "@/components/Radar";

export const metadata: Metadata = {
  title: "Wallet radar · yeppo",
  description: "Follow your own wallets from Axiom and the wallets yeppo proved: what they buy on pump.fun right now, and an early call when two of yours get in and yeppo reads the coin Safe.",
};

// the radar on yeppo.it, with the key this browser keeps (the side panel shows the same radar)
export default function Page() {
  return (
    <Paper>
      <main className="page">
        <div className="page-head">
          <span className="label">
            <i>§</i> Wallet radar
          </span>
          <h1>Your wallets buy. yeppo opens the file.</h1>
          <p>The coins your wallets enter, read the moment they enter. Every line of your rule is checked; when all of them pass and the stamp is Safe, it is an early call.</p>
        </div>
        <div className="p-tool">
          <div className="screen">
            <div className="p-screen-head">
              <span>
                <i /> Live · every 5 seconds
              </span>
              <span>radar</span>
            </div>
            <div className="p-screen-body cp">
              <Radar pkey={null} pdev={null} />
            </div>
          </div>
          <aside>
            <span className="label">The rule</span>
            <ol>
              <li>2 or more of your wallets in within 15 minutes, none out</li>
              <li>The creator paid by an exchange or a whale, with no rugs</li>
              <li>Mint and freeze revoked, liquidity locked</li>
              <li>Top 10 holders under 30%</li>
              <li>At least $25K market cap</li>
              <li>yeppo&apos;s stamp: Safe</li>
            </ol>
            <span className="label">How to use it</span>
            <p>Paste the wallet list Axiom exports (Wallet tracker, Export). The wallets yeppo found on its own export back to Axiom in one click.</p>
            <p>yeppo never trades and never sees your wallet. Size, stop and exit are yours.</p>
          </aside>
        </div>
      </main>
    </Paper>
  );
}
