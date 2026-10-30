"use client";

import { useRouter } from "next/navigation";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { rpc } from "@/lib/supabase";
import type { Hot } from "@/lib/types";
import { Num } from "./Bits";
import HotBoard from "./HotBoard";
import Search from "./Search";
import TopBar from "./TopBar";

export default function Home() {
  const router = useRouter();
  const { data } = usePoll<Hot>(() => rpc<Hot>("yr_oracle_hot"), 8000, "hot");
  const now = useNow(1000);
  const sol = useSol() || 150;
  const recorded = data?.recorded ?? 0;
  const coins = data?.coins ?? null;
  const example = coins?.find((c) => c[10] && !c[10].old)?.[0] ?? coins?.[0]?.[0];
  return (
    <>
      <TopBar live={data ? `${recorded.toLocaleString("en-US")} coins remembered` : null} search={false} />
      <main className="wrap">
        <div className="hero">
          <span className="kicker">
            <i className="dot" /> Watching every pump.fun launch, live
          </span>
          <h1 className="disp">
            See the <span className="shine">future</span> of any memecoin.
          </h1>
          <p className="lead">
            yeppo watches every new pump.fun coin from birth and remembers what happened next. Paste a coin and see how the 30 coins that looked
            exactly like it ended up.
          </p>
          <Search autoFocus />
          {example && (
            <div className="try">
              No coin in mind?
              <button onClick={() => router.push(`/c/${example}`)}>Scan the hottest one right now</button>
            </div>
          )}
          <div className="hero-stats">
            <div>
              <b className="mono">
                <Num value={recorded} fmt={(v) => Math.round(v).toLocaleString("en-US")} />
              </b>
              <span>coins remembered</span>
            </div>
            <div>
              <b className="mono">30</b>
              <span>look-alikes per scan</span>
            </div>
            <div>
              <b className="mono">10s</b>
              <span>between updates</span>
            </div>
            <div>
              <b className="mono">$0</b>
              <span>no wallet, no signup</span>
            </div>
          </div>
        </div>

        <section>
          <div className="sec-title">
            <h2 className="disp">Live oracle board</h2>
            <span className="small dim">The most traded young coins, scored by what their look-alikes did next</span>
          </div>
          <HotBoard coins={coins} now={now} sol={sol} />
        </section>

        <section>
          <div className="sec-title">
            <h2 className="disp">How the oracle sees the future</h2>
          </div>
          <div className="how">
            <div className="step glass">
              <div className="num">1</div>
              <h3>It watches every birth</h3>
              <p>Every pump.fun coin, every trade, every wallet, from the first second. Nothing is skipped and nothing costs you a cent.</p>
            </div>
            <div className="step glass">
              <div className="num">2</div>
              <h3>It finds the look-alikes</h3>
              <p>
                Same age, same chart shape, same buying pressure, same kind of holders. Out of thousands of coins it picks the 30 that looked the
                most like yours.
              </p>
            </div>
            <div className="step glass">
              <div className="num">3</div>
              <h3>It shows you what came next</h3>
              <p>Their next 10 minutes, drawn on your chart. Plus who is holding your coin and when they usually sell.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>yeppo oracle · free · data from the Solana chain and pump.fun, read live by yeppo</span>
        <span>
          Odds come from what past coins did. They are not a promise and not financial advice. Memecoins can go to zero in seconds.
        </span>
      </div>
    </footer>
  );
}
