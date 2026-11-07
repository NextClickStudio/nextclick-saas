import type { Metadata } from "next";
import Radar from "@/components/Radar";

export const metadata: Metadata = {
  title: "Wallet radar · yeppo",
  description: "Follow your own wallets from Axiom and the wallets yeppo proved: what they buy on pump.fun right now, and an early call when two of yours get in and yeppo reads the coin Safe.",
};

// the radar on yeppo.it, with the key this browser keeps (the side panel shows the same radar)
export default function Page() {
  return (
    <main className="page" style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 64px" }}>
      <div className="cp">
        <Radar pkey={null} pdev={null} />
      </div>
    </main>
  );
}
