"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASSET_LIST, usePrices } from "@/lib/market";
import { assetPrice, pct, pts } from "@/lib/format";
import { isSoundOn, setSoundOn, sfx } from "@/lib/fx";
import { useApp } from "./AppProvider";
import { Flash } from "./ui";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/launch", label: "Launch" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function TopNav() {
  const { me, session, openAuth } = useApp();
  const path = usePathname();
  const prices = usePrices();
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSoundOn()), []);

  return (
    <header className="nav">
      <div className="nav-row">
        <Link href="/" className="brand" aria-label="yeppo botmarket">
          <span className="brand-dot" />
          yeppo<span className="brand-sub">botmarket</span>
        </Link>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={(l.href === "/" ? path === "/" : path.startsWith(l.href)) ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="nav-ticker" aria-label="Live prices">
          {ASSET_LIST.map((a) => {
            const t = prices[a];
            return (
              <span key={a} className="tk">
                <b>{a}</b>
                <Flash value={t?.price ?? 0} className="mono">
                  {t ? assetPrice(t.price) : "—"}
                </Flash>
                <span className={`mono t-${t ? (t.chg >= 0 ? "up" : "down") : "flat"}`}>{t ? pct(t.chg) : ""}</span>
              </span>
            );
          })}
        </div>
        <div className="nav-right">
          {session && me ? (
            <>
              <Link href="/portfolio" id="nav-balance" className="balance" title="Your points">
                <i />
                <Flash value={me.balance} className="mono">
                  {pts(me.balance)}
                </Flash>
                <span>pts</span>
              </Link>
              <Link href="/portfolio" className="handle">
                @{me.handle}
              </Link>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-xs" onClick={() => openAuth("login")}>
                Log in
              </button>
              <button className="btn btn-primary btn-xs" onClick={() => openAuth("signup")}>
                Get 10K pts
              </button>
            </>
          )}
          <button
            className="icon-btn"
            aria-label={sound ? "Mute sounds" : "Unmute sounds"}
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
              if (!sound) sfx.coin();
            }}
          >
            {sound ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="m22 9-6 6M16 9l6 6" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <nav className="nav-links nav-links-m">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={(l.href === "/" ? path === "/" : path.startsWith(l.href)) ? "on" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
