"use client";

import { useEffect, useRef, useState } from "react";
import type { Ranked } from "@/lib/arena";
import { confetti, sfx } from "@/lib/fx";
import { fmtPct, fmtSol, tone } from "@/lib/format";
import { readLocal } from "@/lib/supabase";
import type { Room } from "@/lib/types";

export function JoinGate({ room, onJoin, onClose }: { room: Room; onJoin: (nick: string) => Promise<void>; onClose: () => void }) {
  const [nick, setNick] = useState(() => readLocal("yeppo:nick", ""));
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr(null);
    setLoading(true);
    try {
      await onJoin(nick.trim());
    } catch (x) {
      sfx.error();
      setErr(x instanceof Error ? x.message : "Errore");
      setLoading(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="join-title">
        <div className="modal-kicker mono">
          {room.name} · #{room.code}
        </div>
        <h2 id="join-title">Entra nell&apos;arena</h2>
        <p>
          Ricevi <b className="t-up">{+room.start_balance} SOL finti</b>. Fai trading sulle memecoin reali, in diretta. Allo scadere vince
          chi ha il saldo più alto
          {+room.prize_sol > 0 && (
            <>
              {" "}
              e si porta a casa <b className="t-gold">{+room.prize_sol} SOL</b>
              {room.prize_note && ` (${room.prize_note})`}
            </>
          )}
          .
        </p>
        <form onSubmit={submit} className="join-form">
          <input
            autoFocus
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Il tuo nickname"
            maxLength={16}
            aria-label="Nickname"
            spellCheck={false}
          />
          <button className="btn-buy btn-xl" disabled={loading || nick.trim().length < 2}>
            {loading ? "Entro…" : `⚡ Entra con ${+room.start_balance} SOL finti`}
          </button>
        </form>
        {err && <div className="form-err">{err}</div>}
        <ul className="rules-mini">
          <li>Nessun soldo vero, zero rischio</li>
          <li>Fee 1% + slippage sulla liquidità reale</li>
          <li>Max 5 SOL a trade · coin sotto $5K bloccate</li>
        </ul>
        <button className="link" onClick={onClose}>
          Guarda da spettatore
        </button>
      </div>
    </div>
  );
}

export function EndScreen({
  room,
  ranked,
  meId,
  onQuick,
  onClose,
}: {
  room: Room;
  ranked: Ranked[];
  meId: string | null;
  onQuick: () => void;
  onClose: () => void;
}) {
  const mine = ranked.find((r) => r.player.id === meId) ?? null;
  const top = ranked.slice(0, 3);
  const celebrated = useRef(false);

  useEffect(() => {
    if (!room.finalized || celebrated.current || !mine) return;
    celebrated.current = true;
    if (mine.rank <= 3) {
      sfx.win();
      confetti();
      setTimeout(() => confetti(), 400);
    }
  }, [room.finalized, mine]);

  const shareText = mine
    ? `Ho chiuso #${mine.rank} su ${ranked.length} nell'Arena di yeppo.it con ${fmtPct(mine.pnlPct)} 🚀 Memecoin reali, soldi finti.`
    : `Sto guardando l'Arena memecoin di yeppo.it: memecoin reali, soldi finti 🚀`;
  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(
    typeof window !== "undefined" ? `${window.location.origin}/r/${room.code}` : "https://yeppo.it",
  )}`;

  return (
    <div className="modal-back">
      <div className="modal modal-end" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <div className="modal-kicker mono">Arena finita · #{room.code}</div>
        <h2 id="end-title">{room.finalized ? "Classifica finale" : "Calcolo la classifica…"}</h2>
        {top.length ? (
          <div className="podium">
            {[1, 0, 2].map((i) => {
              const r = top[i];
              if (!r) return <div key={i} className="podium-col empty" />;
              return (
                <div key={r.player.id} className={`podium-col p${r.rank}`}>
                  <span className="podium-medal">{["🥇", "🥈", "🥉"][r.rank - 1]}</span>
                  <b>{r.player.nickname}</b>
                  <span className="mono">{fmtSol(r.equity)} SOL</span>
                  <span className={`mono t-${tone(r.pnlPct)}`}>{fmtPct(r.pnlPct)}</span>
                  <div className="podium-block">#{r.rank}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Nessun trader in questa stanza.</p>
        )}
        {mine && (
          <div className="end-me">
            Sei arrivato <b className="t-cyan">#{mine.rank}</b> su {ranked.length} · <span className="mono">{fmtSol(mine.equity)} SOL</span>{" "}
            <span className={`mono t-${tone(mine.pnlPct)}`}>{fmtPct(mine.pnlPct)}</span>
          </div>
        )}
        {+room.prize_sol > 0 && room.finalized && top[0] && (
          <div className="end-prize">
            🏆 Premio di <b className="t-gold">{+room.prize_sol} SOL</b> a <b>{top[0].player.nickname}</b>
            {room.prize_note && <span className="muted"> ({room.prize_note})</span>}
          </div>
        )}
        <div className="end-cta">
          <a className="btn-ghost" href={shareUrl} target="_blank" rel="noreferrer">
            Condividi su 𝕏
          </a>
          <button className="btn-buy" onClick={onQuick}>
            ⚡ Nuova arena
          </button>
        </div>
        <div className="end-links">
          <button className="link" onClick={onClose}>
            Guarda la stanza
          </button>
          <a className="link" href="/">
            Torna alla lobby
          </a>
        </div>
      </div>
    </div>
  );
}

export function HelpStrip({ onClose }: { onClose: () => void }) {
  return (
    <div className="help">
      <span>
        <b>1</b> Scegli una coin
      </span>
      <span>
        <b>2</b> Compra con i tuoi SOL finti
      </span>
      <span>
        <b>3</b> Vendi in profitto e scala la classifica
      </span>
      <span className="help-rules muted">fee 1% · slippage reale · max 5 SOL/trade</span>
      <button className="link" onClick={onClose} aria-label="Chiudi aiuto">
        Ho capito ×
      </button>
    </div>
  );
}

export function Countdown({ ms }: { ms: number }) {
  const s = Math.ceil(ms / 1000);
  return (
    <div className="countdown" aria-live="assertive">
      <b key={s}>{s}</b>
    </div>
  );
}
