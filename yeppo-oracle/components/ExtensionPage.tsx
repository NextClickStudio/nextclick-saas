"use client";

import { useState } from "react";
import Nav, { Footer } from "./Nav";
import Reveal from "./Reveal";

const SITES = ["pump.fun", "GMGN", "Axiom", "Photon", "BullX", "DexScreener", "Birdeye", "Jupiter"];

export default function ExtensionPage() {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Nav />
      <main className="page wrap">
        <Reveal className="page-head">
          <span className="kicker">
            <i className="live" /> Chrome, Brave, Edge, Arc
          </span>
          <h1>
            yeppo, <span className="grad">next to your chart.</span>
          </h1>
          <p>Open a coin. A badge tells you Momentum, Wait or Don&apos;t buy. Click it for the full read.</p>
          <div className="hero-cta" style={{ marginTop: 22 }}>
            <a className="btn btn-go btn-lg" href="/yeppo-extension.zip" download>
              Download the extension
            </a>
          </div>
          <p className="hero-note">
            Version 2.4.2 · installs in a minute · needs a <a href="/pricing">Pro key</a>
          </p>
        </Reveal>

        <span className="label">Install in 4 steps</span>
        <ol className="ext-steps" style={{ marginTop: 12 }}>
          {[
            [
              "Download and unzip",
              <>
                <a href="/yeppo-extension.zip" download>
                  Download the zip
                </a>
                , then double-click it. You get a folder called <span className="mono">yeppo-extension</span>.
              </>,
            ],
            [
              "Open your extensions",
              <>
                Paste in the address bar:{" "}
                <button
                  className="copy-btn mono"
                  onClick={() =>
                    void navigator.clipboard?.writeText("chrome://extensions").then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    })
                  }
                >
                  {copied ? "copied ✓" : "chrome://extensions ⧉"}
                </button>
              </>,
            ],
            ["Turn on Developer mode", <>The switch in the top right corner.</>],
            [
              "Load it",
              <>
                Click <b>Load unpacked</b> and pick the <span className="mono">yeppo-extension</span> folder. Pin it from the puzzle icon.
              </>,
            ],
          ].map(([h, p], i) => (
            <Reveal key={i} as="li" className="card ext-step" delay={i * 70}>
              <b>{i + 1}</b>
              <div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            </Reveal>
          ))}
        </ol>

        <div style={{ marginTop: 40 }}>
          <span className="label">Works on</span>
          <div className="sites" style={{ marginTop: 12 }}>
            {SITES.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p className="card note">🔒 It only reads the coin address on the page. It never sees your wallet or keys, and it can&apos;t trade.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
