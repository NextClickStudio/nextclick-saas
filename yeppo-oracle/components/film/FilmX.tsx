"use client";

// Film 03 · Hot on X. A post lands; coins are launched after it and run out of it on lines; yeppo stamps each one;
// the Danger and Risky ones drop away; the Safe one stays, and two of the viewer's wallets are in it. 12 seconds.
import { at, io, k, mix, out, type Film } from "./engine";
import { Rise } from "./parts";

const COINS: { sym: string; v: "Safe" | "Risky" | "Danger"; why: string; y: number }[] = [
  { sym: "$WHALE", v: "Safe", why: "2 of your wallets in", y: 170 },
  { sym: "$OCEAN", v: "Danger", why: "launch bundle 41%", y: 290 },
  { sym: "$BACK", v: "Risky", why: "creator's 9th coin today", y: 410 },
  { sym: "$WHALES", v: "Danger", why: "copy of a coin that rugged", y: 530 },
];
const DOT = { Safe: "#5fe3a1", Risky: "#ffbe55", Danger: "#ff6a4d" };

function Scene({ t }: { t: number }) {
  const post = k(t, 0.3, 1.2);
  return (
    <div className="fm">
      <div className="fm-post" style={at(110, 250, { opacity: post, transform: `translateY(${mix(30, 0, out(post))}px)` })}>
        <div className="fm-post-who">
          <i />
          <b>@a_large_account</b>
          <span>· 2.1M · just now</span>
        </div>
        <p>
          whales are back.
          <br />
          the ocean always wins.
        </p>
        <div className="fm-post-n" style={{ opacity: k(t, 1.6, 2.0) }}>
          {Math.round(mix(0, 4, k(t, 1.8, 5.2, (x) => x)))} coins launched after it
        </div>
      </div>
      <svg width="1280" height="800" style={at(0, 0)}>
        {COINS.map((c, i) => {
          const p = k(t, 1.8 + i * 0.6, 2.6 + i * 0.6, io);
          const gone = c.v !== "Safe" ? k(t, 7.2 + i * 0.15, 7.9 + i * 0.15) : 0;
          const x1 = 530, y1 = 330, x2 = 760, y2 = c.y + 34;
          return (
            <path
              key={c.sym}
              d={`M${x1} ${y1} C ${x1 + 120} ${y1}, ${x2 - 120} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={c.v === "Safe" && t > 8 ? "#fff" : "#4a4a4a"}
              strokeWidth={c.v === "Safe" && t > 8 ? 2 : 1.2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - p}
              opacity={1 - gone}
            />
          );
        })}
      </svg>
      {COINS.map((c, i) => {
        const s = 2.4 + i * 0.6;
        const v = k(t, s, s + 0.6);
        const stamped = k(t, 5.4 + i * 0.4, 5.8 + i * 0.4);
        const gone = c.v !== "Safe" ? k(t, 7.2 + i * 0.15, 8.0 + i * 0.15, io) : 0;
        const lift = c.v === "Safe" ? k(t, 8.0, 9.0) : 0;
        return (
          <div
            key={c.sym}
            className={`fm-born ${c.v === "Safe" && t > 8 ? "keep" : ""}`}
            style={at(760, c.y, {
              opacity: v * (1 - gone),
              transform: `translate(${mix(30, 0, out(v)) + gone * 60}px, ${gone * 26 - lift * 10}px) scale(${mix(1, 1.06, lift)})`,
            })}
          >
            <b>{c.sym}</b>
            <span>{stamped > 0.5 ? c.why : "reading…"}</span>
            <em style={{ opacity: stamped }}>
              <i style={{ background: DOT[c.v] }} />
              {c.v}
            </em>
          </div>
        );
      })}
      <Rise p={k(t, 9.4, 10.1)} className="fm-note" style={at(760, 660)}>
        From your J7 feed, or from X as yeppo sees it.
      </Rise>
    </div>
  );
}

export const filmX: Film = {
  id: "x",
  title: "Hot on X",
  line: "A post lands, coins are born after it. yeppo reads them all, hides the bad ones and shows the one your wallets are buying.",
  duration: 12,
  chapters: [
    { at: 0, label: "A post" },
    { at: 2.2, label: "Coins born" },
    { at: 5.3, label: "Read" },
    { at: 7.2, label: "What's left" },
  ],
  caption: (t) => (t < 2.2 ? "A post that matters lands on X." : t < 5.3 ? "Coins are launched after it, one after the other." : t < 7.2 ? "yeppo reads every one of them." : t < 11.3 ? "The bad ones drop. Your wallets are in the one left." : ""),
  Scene,
};
