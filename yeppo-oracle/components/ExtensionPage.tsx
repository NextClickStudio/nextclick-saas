"use client";

import { useState } from "react";
import { Eye } from "./Bits";
import { Footer } from "./Home";
import TopBar from "./TopBar";

const SITES = ["pump.fun", "GMGN", "Axiom", "Photon", "BullX", "DexScreener", "Birdeye", "Jupiter"];

export default function ExtensionPage() {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <TopBar />
      <main className="wrap ext">
        <div className="hero ext-hero">
          <span className="kicker">
            <i className="dot" /> Free · Chrome, Brave, Edge, Arc
          </span>
          <h1 className="disp">
            yeppo, <span className="shine">right next to your chart</span>
          </h1>
          <p className="lead">
            Open a coin. yeppo reads it next to your chart, with an exit plan, and watches your bags below.
          </p>
          <a className="btn btn-glow btn-lg" href="/yeppo-extension.zip" download>
            ⬇ Download the extension
          </a>
          <p className="small dim">Version 1.2 · 30 KB · installs in a minute</p>
        </div>

        <div className="ext-demo glass" aria-hidden>
          <div className="ext-page">
            <div className="ext-chart">
              <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                <path d="M0 100 L30 92 L60 96 L90 70 L120 76 L150 50 L180 58 L210 34 L240 40 L270 22 L300 28" fill="none" stroke="#38e1ff" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="ext-pill t-up">
              <Eye size={18} />
              <b>yeppo</b>
              <span>Runner potential</span>
              <i className="mono">72</i>
            </div>
          </div>
          <div className="ext-side">
            <div className="ext-side-top">
              <Eye size={16} /> <b>yeppo</b>
            </div>
            <div className="ext-verdict">
              <b>🔥 Runner potential</b>
              <span>9 of the 30 look-alikes went up 50%+ in the next 10 minutes, only 2 dumped.</span>
            </div>
            <div className="ext-line">
              🎯 Exit plan: take profit <b className="up">+45%</b>, cut <b className="down">−25%</b>, out within 4 min
            </div>
            <div className="ext-line">✅ Clean dev: 2 of 5 coins went big, no rugs.</div>
            <div className="ext-line">🛡 My wallet: $WIF3 GET OUT, the dev sold.</div>
          </div>
        </div>

        <section>
          <div className="sec-title">
            <h2 className="disp">What it does</h2>
          </div>
          <div className="checks">
            <div className="check glass">
              <h3>Spots the coin by itself</h3>
              <p>No copy and paste, even on pages that only show the pool.</p>
            </div>
            <div className="check glass">
              <h3>A badge with the verdict</h3>
              <p>Runner potential, Coin flip or Likely dump, right on the page.</p>
            </div>
            <div className="check glass">
              <h3>An exit plan before you buy</h3>
              <p>Take profit, stop and time limit, tested on 30 look-alikes.</p>
            </div>
            <div className="check glass">
              <h3>Your wallet, right below</h3>
              <p>Every bag gets GET OUT, WATCH or HOLD.</p>
            </div>
          </div>
        </section>

        <section>
          <div className="sec-title">
            <h2 className="disp">Install it in 4 steps</h2>
          </div>
          <ol className="steps">
            <li className="glass">
              <b>1</b>
              <div>
                <h3>Download and unzip</h3>
                <p>
                  <a href="/yeppo-extension.zip" download>
                    Download the zip
                  </a>{" "}
                  and double-click it. You get a folder called <span className="mono">yeppo-extension</span>.
                </p>
              </div>
            </li>
            <li className="glass">
              <b>2</b>
              <div>
                <h3>Open your extensions page</h3>
                <p>
                  Paste this in the address bar:{" "}
                  <button
                    className="copy-mint mono"
                    onClick={() =>
                      void navigator.clipboard?.writeText("chrome://extensions").then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      })
                    }
                  >
                    {copied ? "copied ✓" : "chrome://extensions ⧉"}
                  </button>
                </p>
              </div>
            </li>
            <li className="glass">
              <b>3</b>
              <div>
                <h3>Turn on Developer mode</h3>
                <p>It is the switch in the top right corner of that page.</p>
              </div>
            </li>
            <li className="glass">
              <b>4</b>
              <div>
                <h3>Load it</h3>
                <p>
                  Click <b>Load unpacked</b> and pick the <span className="mono">yeppo-extension</span> folder. Then pin yeppo from the puzzle icon
                  so it is always in your toolbar.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section>
          <div className="sec-title">
            <h2 className="disp">Works on</h2>
          </div>
          <div className="ext-sites">
            {SITES.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p className="ext-privacy glass">
            🔒 The extension only reads the address of the coin on the page. It never sees your wallet, your keys or your trades, and it cannot
            trade for you.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
