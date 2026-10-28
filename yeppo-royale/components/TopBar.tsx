"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isSoundOn, setSoundOn } from "@/lib/fx";
import { level, tier } from "@/lib/rank";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";

const TABS = [
  { href: "/", label: "Play" },
  { href: "/locker", label: "Profile" },
  { href: "/career", label: "Career" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/shop", label: "Shop", soon: true },
];

export default function TopBar({ online }: { online?: number }) {
  const path = usePathname();
  const { me, session, openCreator } = useApp();
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSoundOn()), []);
  const lv = level(me?.xp ?? 0);
  const t = tier(me?.rp ?? 0);

  return (
    <header className="topbar">
      <Link href="/" className="logo">
        yeppo <b>royale</b>
        <span>trading battle royale</span>
      </Link>
      <nav className="tabs">
        {TABS.map((x) => (
          <Link key={x.href} href={x.href} className={path === x.href ? "on" : ""}>
            {x.label}
            {x.soon && <span className="soon">SOON</span>}
          </Link>
        ))}
      </nav>
      <div className="topbar-right">
        {online != null && (
          <span className="online">
            <i /> {online} online
          </span>
        )}
        {me ? (
          <>
            <span className="tier-pill" title={`${me.rp} rank points`}>
              <i className="tier-gem" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
              {t.name}
            </span>
            <div className="lvl-badge" title={`${lv.into} / ${lv.need} XP`}>
              <div className="lvl-hex mono">{lv.lvl}</div>
              <div className="lvl-meta">
                <span className="lbl">Level {lv.lvl}</span>
                <div className="bar">
                  <i style={{ width: `${lv.pct}%` }} />
                </div>
              </div>
            </div>
            <Link href="/locker" aria-label="Your character">
              <Avatar look={me.avatar} size={28} />
            </Link>
          </>
        ) : (
          !session && (
            <button className="btn btn-gold btn-sm" onClick={() => openCreator(true)}>
              Create profile
            </button>
          )
        )}
        <button
          className="icon-btn"
          aria-label={sound ? "Mute sounds" : "Unmute sounds"}
          onClick={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m16 9 6 6m0-6-6 6" />}
          </svg>
        </button>
      </div>
    </header>
  );
}
