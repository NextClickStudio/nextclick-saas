"use client";

// The home's opening: yeppo's read as a case file on a desk. The findings sit under black redaction bars that lift
// one by one, then the stamp comes down and the file is slid off the pile for the next one. Three example coins,
// one for each stamp; the findings are the kind yeppo reports.
import { useEffect, useState } from "react";

type Row = [string, string, boolean];
type Case = { no: string; sym: string; mint: string; age: string; word: "Safe" | "Risky" | "Danger"; why: string; rows: Row[] };

const CASES: Case[] = [
  {
    no: "0417",
    sym: "$GOAT",
    mint: "7n7S…Ggpump",
    age: "4 min old",
    word: "Danger",
    why: "launch bundle and a creator who rugs",
    rows: [
      ["Launch bundle", "38% · 7 wallets, one block", false],
      ["Creator", "14th coin today · 11 dumped", false],
      ["Money behind", "funder's coins rugged 9 times", false],
      ["Top 10 holders", "41%", false],
      ["Mint & freeze", "revoked", true],
      ["Liquidity", "on the bonding curve", true],
    ],
  },
  {
    no: "0418",
    sym: "$SEAL",
    mint: "4kQp…Rhpump",
    age: "9 min old",
    word: "Safe",
    why: "nothing wrong found in 24 checks",
    rows: [
      ["Launch bundle", "3.1% · 4 wallets", true],
      ["Creator", "2nd coin · no rugs", true],
      ["Money behind", "paid by an exchange", true],
      ["Top 10 holders", "18.6%", true],
      ["Linked wallets", "none", true],
      ["Mint & freeze", "revoked", true],
    ],
  },
  {
    no: "0419",
    sym: "$BOOK",
    mint: "9xTw…2Lpump",
    age: "21 min old",
    word: "Risky",
    why: "one big wallet is selling",
    rows: [
      ["Launch bundle", "6.0% · 3 wallets", true],
      ["Creator", "first coin", true],
      ["Money behind", "a fresh wallet, 2 SOL", true],
      ["Top 10 holders", "24%", true],
      ["Biggest wallet", "11% · selling now", false],
      ["Mint & freeze", "revoked", true],
    ],
  },
];

const STEP_MS = 420;

export default function CaseFile() {
  const [top, setTop] = useState(0); // the case on top of the pile
  const [step, setStep] = useState(0); // bars lifted on it; rows + 1 = stamped; rows + 2 = sliding off
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      setStep(99);
      return;
    }
    const rows = CASES[top].rows.length;
    // bars, then a beat, the stamp, a long hold, then off the pile
    const wait = step === 0 ? 900 : step < rows ? STEP_MS : step === rows ? 520 : step === rows + 1 ? 2600 : 760;
    const t = setTimeout(() => {
      if (step >= rows + 2) {
        setTop((v) => (v + 1) % CASES.length);
        setStep(0);
      } else setStep((s) => s + 1);
    }, wait);
    return () => clearTimeout(t);
  }, [step, top]);

  return (
    <div className="cf" aria-label="An example of yeppo's read: findings, then a stamp">
      {CASES.map((c, i) => {
        const pos = (i - top + CASES.length) % CASES.length; // 0 on top, 1 and 2 below
        const rows = c.rows.length;
        const isTop = pos === 0;
        const lifted = isTop ? step : still ? 99 : 0;
        const stamped = lifted > rows;
        const leaving = isTop && !still && step >= rows + 2;
        return (
          <article key={c.no} className={`cf-sheet p${pos} ${leaving ? "out" : ""}`} aria-hidden={!isTop}>
            <header className="cf-head">
              <span>File No. {c.no}</span>
              <span>
                pump.fun · {c.age}
              </span>
            </header>
            <div className="cf-title">
              <b>{c.sym}</b>
              <span className="mono">{c.mint}</span>
            </div>
            <dl className="cf-rows">
              {c.rows.map(([k, v, ok], r) => (
                <div key={k} className={`cf-row ${ok ? "" : "bad"} ${lifted > r ? "open" : ""}`}>
                  <dt>{k}</dt>
                  <dd>
                    <span>{v}</span>
                    <i className="cf-bar" />
                  </dd>
                </div>
              ))}
            </dl>
            <footer className="cf-foot">
              <span>Verdict</span>
              <span className={`cf-why ${stamped ? "on" : ""}`}>{c.why}</span>
            </footer>
            <div className={`cf-stamp t-${c.word.toLowerCase()} ${stamped ? "down" : ""}`}>
              <span>{c.word}</span>
            </div>
          </article>
        );
      })}
      <span className="cf-tag">example files</span>
    </div>
  );
}
