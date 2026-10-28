"use client";

import { useState } from "react";
import type { Ranked } from "@/lib/arena";
import { isSoundOn, setSoundOn, sfx, toast } from "@/lib/fx";
import { fmtClock, fmtPct, fmtSol, tone } from "@/lib/format";
import type { Room, RoomStatus } from "@/lib/types";
import { Logo } from "../ui";

type Props = {
  room: Room;
  status: RoomStatus;
  now: number;
  playersCount: number;
  me: Ranked | null;
  onJoin: () => void;
};

export default function TopBar({ room, status, now, playersCount, me, onJoin }: Props) {
  const [sound, setSound] = useState(isSoundOn);
  const left = status === "upcoming" ? Date.parse(room.starts_at) - now : status === "live" ? Date.parse(room.ends_at) - now : 0;
  const urgent = status === "live" && left <= 60_000;

  function share() {
    const url = `${window.location.origin}/r/${room.code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast("Link della stanza copiato: invita i tuoi amici", "info"),
      () => toast(url, "info"),
    );
  }

  function toggleSound() {
    setSoundOn(!sound);
    setSound(!sound);
    if (!sound) sfx.buy();
  }

  return (
    <header className="topbar">
      <Logo />
      <div className="tb-room">
        <b className="tb-name">{room.name}</b>
        <button className="chip chip-btn" onClick={share} title="Copia link invito">
          #{room.code} ⧉
        </button>
        {room.kind === "official" && <span className="chip chip-gold">UFFICIALE</span>}
      </div>
      <div className={`tb-status st-${status} ${urgent ? "urgent" : ""}`}>
        <span className={`status-pill st-${status}`}>
          {status === "live" && <i className="live-dot" />}
          {status === "live" ? "LIVE" : status === "upcoming" ? "INIZIA TRA" : "FINITA"}
        </span>
        <b className="mono tb-clock">{fmtClock(left)}</b>
      </div>
      {+room.prize_sol > 0 && (
        <div className="tb-prize">
          🏆 <b className="t-gold">{+room.prize_sol} SOL</b>
          {room.prize_note && <small className="muted"> {room.prize_note}</small>}
        </div>
      )}
      <div className="tb-players mono">
        👥 {playersCount}/{room.max_players}
      </div>
      <div className="tb-spacer" />
      {me ? (
        <div className="tb-me">
          <div>
            <label>Saldo</label>
            <b className="mono">{fmtSol(me.equity)} SOL</b>
          </div>
          <div>
            <label>PnL</label>
            <b className={`mono t-${tone(me.pnlPct)}`}>{fmtPct(me.pnlPct)}</b>
          </div>
          <div>
            <label>Rank</label>
            <b className="mono t-cyan">#{me.rank}</b>
          </div>
        </div>
      ) : (
        status !== "ended" && (
          <button className="btn-buy btn-sm" onClick={onJoin}>
            Entra in gara
          </button>
        )
      )}
      <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Disattiva suoni" : "Attiva suoni"}>
        {sound ? "🔊" : "🔇"}
      </button>
    </header>
  );
}
