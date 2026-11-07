"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isSoundOn, setSoundOn } from "@/lib/fx";
import { tier } from "@/lib/rank";
import { useApp } from "./AppProvider";
import Avatar from "./Avatar";

const TABS = [
  { href: "/", label: "Play" },
  { href: "/real", label: "Real duels", tag: "ON-CHAIN" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/career", label: "Profile" },
];

export default function TopBar({ online }: { online?: number }) {
  const path = usePathname();
  const { me, session, openCreator } = useApp();
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSoundOn()), []);
  const t = tier(me?.elo ?? 1000);

  return (
    <header className="topbar">
      <Link href="/" className="logo">
        <span className="logo-mark" aria-hidden>
          <i />
          <i />
        </span>
        yeppo<b>1v1</b>
      </Link>
      <nav className="tabs">
        {TABS.map((x) => (
          <Link key={x.href} href={x.href} className={(x.href === "/" ? path === "/" : path.startsWith(x.href)) ? "on" : ""}>
            {x.label}
            {x.tag && <span className="tag">{x.tag}</span>}
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
          <Link href="/career" className="me-chip" title={`${t.name} · ${me.elo} rating`}>
            <span className="tier-gem" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
            <span className="mono">{me.elo}</span>
            <Avatar look={me.avatar} size={24} />
          </Link>
        ) : (
          !session && (
            <button className="btn btn-primary btn-sm" onClick={() => openCreator(true)}>
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
