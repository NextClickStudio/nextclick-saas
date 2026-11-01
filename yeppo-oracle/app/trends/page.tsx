import type { Metadata } from "next";
import Nav, { Footer } from "@/components/Nav";
import Trends from "@/components/Trends";

export const metadata: Metadata = { title: "Scanner · yeppo", description: "Free Solana memecoin scanner: new pump.fun coins that proven wallets are buying right now, and the memes launching far more than usual, after yeppo's rug and bundle checks.", alternates: { canonical: "/trends" } };

export default function Page() {
  return (
    <>
      <Nav />
      <main className="page wrap" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <span className="label">Live</span>
          <h1>scanner.</h1>
          <p>yeppo watches every pump.fun trade and learns which wallets keep getting in early before a coin runs. When several of them buy the same new coin, it shows up here. Below: the memes launching far more than usual, and the coin leading each wave.</p>
        </div>
        <Trends />
      </main>
      <Footer />
    </>
  );
}
