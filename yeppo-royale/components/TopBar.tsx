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
  { href: "/locker", label: "Locker" },
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
      <Link href="/" className="logo display">
        yeppo <b>royale</b>
        <span>trading battle royale</span>
      </Link>
      <nav className="tabs display">
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
              <div className="lvl-hex display">{lv.lvl}</div>
              <div className="lvl-meta">
                <span className="lbl">Level {lv.lvl}</span>
                <div className="bar">
                  <i style={{ width: `${lv.pct}%` }} />
                </div>
              </div>
            </div>
            <Link href="/locker" aria-label="Your character">
              <Avatar look={me.avatar} size={38} />
            </Link>
          </>
        ) : (
          !session && (
            <button className="btn btn-gold btn-sm" onClick={() => openCreator(true)}>
              Create character
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
          {sound ? "🔊" : "🔇"}
        </button>
      </div>
    </header>
  );
}
