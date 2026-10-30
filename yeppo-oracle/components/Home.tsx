"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePoll, useNow, useSol } from "@/lib/hooks";
import { namesOf, type Names } from "@/lib/meta";
import { rpc } from "@/lib/supabase";
import { pct } from "@/lib/format";
import { inTen } from "@/lib/plain";
import type { Hot, HotCoin, Track } from "@/lib/types";
import { Num } from "./Bits";
import HotBoard from "./HotBoard";
import Search from "./Search";
import TopBar from "./TopBar";

export default function Home() {
  const router = useRouter();
  const { data } = usePoll<Hot>(() => rpc<Hot>("yr_oracle_hot"), 8000, "hot");
  const { data: track } = usePoll<Track | null>(() => rpc<Track | null>("yr_otrack"), 300_000, "track");
  const now = useNow(1000);
  const sol = useSol() || 150;
  const recorded = data?.recorded ?? 0;
  const [names, setNames] = useState<Record<string, Names>>({});
  useEffect(() => {
    const missing = (data?.coins ?? []).filter((c) => !c[1] && !c[2]).map((c) => c[0]);
    if (missing.length) void namesOf(missing).then((n) => setNames((p) => ({ ...p, ...n })));
  }, [data]);
  // dust coins (a few hundred dollars) are bots trading with bots: not worth a card
  const coins: HotCoin[] | null = useMemo(
    () =>
      data
        ? data.coins
            .filter((c) => (c[5] ?? 0) >= 5)
            .map((c) => {
              const n = names[c[0]];
              return n && !c[1] && !c[2] ? ([c[0], n.name, n.symbol, n.uri ?? c[3], ...c.slice(4)] as HotCoin) : c;
            })
        : null,
    [data, names],
  );
  const example = coins?.find((c) => c[10] && !c[10].old)?.[0] ?? coins?.[0]?.[0];
  return (
    <>
      <TopBar live={data ? `${recorded.toLocaleString("en-US")} coins remembered` : null} search={false} />
      <main className="wrap">
        <div className="hero">
          <span className="kicker">
            <i className="dot" /> Free · no wallet needed · live every 10 seconds
          </span>
          <h1 className="disp">
            Will this memecoin <span className="shine">pump or dump</span>?
          </h1>
          <p className="lead">
            Paste any new pump.fun coin. yeppo compares it with thousands of coins it watched from their very first trade, checks who made it and
            who holds it, and tells you in plain words what usually happens next.
          </p>
          <Search autoFocus />
          {example && (
            <div className="try">
              No coin in mind?
              <button onClick={() => router.push(`/c/${example}`)}>Try the hottest one right now</button>
            </div>
          )}
          <div className="hero-stats">
            <div>
              <b className="mono">
                <Num value={recorded} fmt={(v) => Math.round(v).toLocaleString("en-US")} />
              </b>
              <span>coins watched from birth</span>
            </div>
            <div>
              <b className="mono">30</b>
              <span>look-alikes compared per coin</span>
            </div>
            <div>
              <b className="mono">10s</b>
              <span>between updates</span>
            </div>
          </div>
        </div>

        <section>
          <div className="sec-title">
            <h2 className="disp">What yeppo checks for you</h2>
          </div>
          <div className="checks">
            <div className="check glass">
              <span className="ic">🔮</span>
              <h3>What usually happens next</h3>
              <p>yeppo finds the 30 past coins that looked exactly like yours at the same age and shows what they did in the next 10 minutes.</p>
            </div>
            <div className="check glass">
              <span className="ic">👤</span>
              <h3>Who made it</h3>
              <p>Every creator gets a record: how many coins they launched, how many they rugged. Serial ruggers get a red flag.</p>
            </div>
            <div className="check glass">
              <span className="ic">🪜</span>
              <h3>Fake pumps</h3>
              <p>Bots that buy in a perfect staircase to fake hype. Coins that climb like that almost always dump, so yeppo calls them out.</p>
            </div>
            <div className="check glass">
              <span className="ic">⏱</span>
              <h3>Who is about to sell</h3>
              <p>yeppo knows how each wallet usually trades. It tells you how much of the coin belongs to wallets that sell within a minute.</p>
            </div>
            <div className="check glass">
              <span className="ic">🛡</span>
              <h3>Your bags, guarded</h3>
              <p>
                Paste your trading wallet in <Link href="/guard">Bag Guard</Link> and yeppo watches every coin you hold. When one turns dangerous, it
                says GET OUT.
              </p>
            </div>
            <div className="check glass">
              <span className="ic">🧩</span>
              <h3>Right next to your chart</h3>
              <p>
                The free <Link href="/extension">browser extension</Link> spots the coin you open on pump.fun, GMGN, Axiom or Photon and shows the
                verdict on the page.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="sec-title">
            <h2 className="disp">How to read it</h2>
            <span className="small dim">Every coin gets one of these, in one sentence</span>
          </div>
          <div className="legend-grid">
            <div className="lg glass">
              <span className="verdict-chip t-up">Runner potential</span>
              <p>Most coins that looked like this went up, very few crashed, and nothing looks fishy.</p>
            </div>
            <div className="lg glass">
              <span className="verdict-chip t-mid">Coin flip</span>
              <p>Some went up, some crashed. No edge either way: a gamble.</p>
            </div>
            <div className="lg glass">
              <span className="verdict-chip t-flat">Going nowhere</span>
              <p>The look-alikes barely moved. The coin is probably fading out.</p>
            </div>
            <div className="lg glass">
              <span className="verdict-chip t-down">Likely dump</span>
              <p>Many coins that looked like this crashed by half within minutes.</p>
            </div>
            <div className="lg glass">
              <span className="verdict-chip t-rug">Rug risk</span>
              <p>A red flag: a creator who rugged before, bots faking the pump, or a creator who already sold.</p>
            </div>
          </div>
        </section>

        <section>
          <div className="sec-title">
            <h2 className="disp">Live right now</h2>
            <span className="small dim">The most traded young coins, sorted by what the oracle thinks of them</span>
          </div>
          <HotBoard coins={coins} now={now} sol={sol} track={track ?? null} />
        </section>

        {track && <TrackRecord t={track} />}

        <section>
          <div className="sec-title">
            <h2 className="disp">Questions</h2>
          </div>
          <div className="faq">
            <details className="glass">
              <summary>Is this financial advice?</summary>
              <p>No. yeppo shows what happened to similar coins in the past. Memecoins are a gamble and can go to zero in seconds.</p>
            </details>
            <details className="glass">
              <summary>Does it cost anything? Do I connect my wallet?</summary>
              <p>It is free and you never connect or sign anything. Bag Guard only reads a public wallet address, like any block explorer.</p>
            </details>
            <details className="glass">
              <summary>Which coins does it read?</summary>
              <p>pump.fun coins that yeppo watched from their first trade, in their first 40 minutes, where almost all of the action is.</p>
            </details>
            <details className="glass">
              <summary>How do I keep it open while I trade?</summary>
              <p>
                On a computer, use the <Link href="/extension">yeppo Chrome extension</Link>: it reads the coin you are looking at on pump.fun, GMGN,
                Axiom or Photon by itself. On any coin page you can also press Pop out.
              </p>
            </details>
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

/** how often the oracle was right, replayed hourly on coins it could not have seen the end of */
export function TrackRecord({ t }: { t: Track }) {
  const dn = t.down?.n ?? 0;
  const up = t.up?.n ?? 0;
  return (
    <section>
      <div className="sec-title">
        <h2 className="disp">Track record</h2>
        <span className="small dim">
          Checked on {t.coins.toLocaleString("en-US")} past coins without peeking at what happened next · updated every hour
        </span>
      </div>
      <div className="track">
        <div className="tcard glass">
          <span className="lbl">When yeppo says &quot;Likely dump&quot;</span>
          <b className="mono down">{dn && t.down.dump50 != null ? inTen(t.down.dump50) : "–"}</b>
          <span className="small">really crashed by half within 10 minutes</span>
          <span className="tiny dim">a random coin: {inTen(t.all.dump50)} · {dn} calls checked</span>
        </div>
        <div className="tcard glass">
          <span className="lbl">When yeppo says &quot;Runner potential&quot;</span>
          <b className="mono up">{up && t.up.hit50 != null ? inTen(t.up.hit50) : "–"}</b>
          <span className="small">really went up by half within 10 minutes</span>
          <span className="tiny dim">a random coin: {inTen(t.all.hit50)} · {up} calls checked</span>
        </div>
        <div className="tcard glass">
          <span className="lbl">Right direction</span>
          <b className="mono">{t.direction != null ? inTen(t.direction) : "–"}</b>
          <span className="small">calls ended up on the side yeppo said, 10 minutes later</span>
          <span className="tiny dim">runner and dump calls</span>
        </div>
      </div>
      <p className="small dim track-note">
        {up && t.up.ret != null && t.up.ret < 0
          ? `Honest note: buying every runner call blindly (sell at +50%, stop at −30%, fees in) still lost ${pct(-t.up.ret, 1)} per trade. yeppo's edge today is telling you what to avoid.`
          : "Odds come from what past coins did. They are not a promise and not financial advice."}
      </p>
    </section>
  );
}
