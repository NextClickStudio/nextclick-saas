"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setSound, soundOn } from "@/lib/sound";
import { Eye } from "./Bits";
import Search from "./Search";

export default function TopBar({ live, search = true }: { live?: string | null; search?: boolean }) {
  const [snd, setSnd] = useState(false);
  useEffect(() => setSnd(soundOn()), []);
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="logo disp">
          <Eye />
          <b>yeppo</b>
          <span className="tag">ORACLE</span>
        </Link>
        <div className="grow" />
        {search && (
          <div className="top-search">
            <Search small />
          </div>
        )}
        <div className="live-pill">
          <i className={`dot ${live ? "" : "off"}`} />
          <span className="txt">{live ?? "connecting…"}</span>
        </div>
        <button
          className="icon-btn"
          title={snd ? "Sound on" : "Sound off"}
          onClick={() => {
            setSound(!snd);
            setSnd(!snd);
          }}
        >
          {snd ? "🔊" : "🔈"}
        </button>
      </div>
    </header>
  );
}
