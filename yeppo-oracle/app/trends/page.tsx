import type { Metadata } from "next";
import Nav, { Footer } from "@/components/Nav";
import Trends from "@/components/Trends";

export const metadata: Metadata = { title: "Meme waves · yeppo", description: "The memes pump.fun is launching most right now, and the coins leading each wave." };

export default function Page() {
  return (
    <>
      <Nav />
      <main className="page wrap" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <span className="label">Live</span>
          <h1>meme waves.</h1>
          <p>When a meme catches, dozens of coins with its name launch in minutes. yeppo spots the wave and the coins leading it.</p>
        </div>
        <Trends />
      </main>
      <Footer />
    </>
  );
}
