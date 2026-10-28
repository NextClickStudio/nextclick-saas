"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { arena, supabase } from "@/lib/supabase";
import { fetchCoins, fetchHotMints, type Coin } from "@/lib/market";
import { fmtClock, fmtPct, fmtUsd, tone } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { roomStatus, type Room } from "@/lib/types";
import { CoinAvatar, Logo } from "./ui";
import HeroVisual from "./HeroVisual";

export default function Lobby() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [ticker, setTicker] = useState<Coin[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const { data } = await supabase
        .from("arena_rooms_live")
        .select("*")
        .neq("kind", "private")
        .gt("ends_at", since)
        .order("starts_at", { ascending: true })
        .limit(40);
      if (alive) setRooms((data as Room[] | null) ?? []);
    };
    load();
    const t = setInterval(load, 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const mints = await fetchHotMints().catch(() => []);
      const coins = await fetchCoins(mints.slice(0, 24)).catch(() => ({}) as Record<string, Coin>);
      if (alive) setTicker(mints.map((m) => coins[m]).filter(Boolean));
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const groups = useMemo(() => {
    const all = rooms ?? [];
    const live = all.filter((r) => roomStatus(r, now) === "live").sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
    const upcoming = all.filter((r) => roomStatus(r, now) === "upcoming");
    const ended = all
      .filter((r) => roomStatus(r, now) === "ended" && (r.players ?? 0) > 0)
      .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))
      .slice(0, 4);
    return { live, upcoming, ended };
  }, [rooms, now]);

  const tradersLive = groups.live.reduce((s, r) => s + (r.players ?? 0), 0);

  async function quick() {
    if (joining) return;
    setJoining(true);
    try {
      const { room } = await arena<{ room: Room }>("quick");
      sfx.go();
      router.push(`/r/${room.code}`);
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Errore", "down");
      setJoining(false);
    }
  }

  return (
    <main className="lobby">
      <header className="lobby-nav">
        <Logo />
        <span className="chip chip-demo">DEMO</span>
        <nav>
          <a href="#stanze">Stanze</a>
          <a href="#come">Come funziona</a>
        </nav>
        <button className="btn-buy btn-sm" onClick={quick} disabled={joining}>
          Gioca
        </button>
      </header>

      <div className="ticker" aria-label="Memecoin in trend">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((c, i) => (
            <span className="ticker-item" key={`${c.mint}-${i}`}>
              <CoinAvatar image={c.image} symbol={c.symbol} mint={c.mint} size={16} />
              <b>${c.symbol}</b>
              <span className="mono">{fmtUsd(c.mcapUsd)}</span>
              <span className={`mono t-${tone(c.chg5m)}`}>{fmtPct(c.chg5m)}</span>
            </span>
          ))}
          {!ticker.length && <span className="ticker-item muted">Connessione al mercato memecoin…</span>}
        </div>
      </div>

      <section className="hero">
        <div className="hero-copy">
        <div className="hero-kicker">
          <i className="live-dot" /> mercato memecoin live · Solana
        </div>
        <h1>
          Trada memecoin <em>reali</em>.
          <br />
          Con soldi <span className="t-down">finti</span>.
        </h1>
        <p className="hero-sub">
          Entri in una stanza da 50 trader, ricevi <b className="t-up">10 SOL finti</b> e fai trading sulle coin vere di pump.fun e
          DexScreener, in diretta. Chi chiude più in alto vince.
        </p>
        <div className="hero-cta">
          <button className="btn-buy btn-xl" onClick={quick} disabled={joining}>
            {joining ? "Cerco una stanza…" : "⚡ Entra subito"}
          </button>
          <a className="btn-ghost btn-xl" href="#stanze">
            Vedi le stanze
          </a>
        </div>
        <div className="hero-stats">
          <div>
            <b className="mono t-up">{groups.live.length}</b>
            <span>stanze live</span>
          </div>
          <div>
            <b className="mono">{tradersLive}</b>
            <span>trader in gara</span>
          </div>
          <div>
            <b className="mono t-cyan">0 €</b>
            <span>rischio reale</span>
          </div>
        </div>
        </div>
        <HeroVisual />
      </section>

      <section id="stanze" className="rooms">
        <div className="section-head">
          <h2>Stanze</h2>
          <span className="muted">Si aggiorna in diretta</span>
        </div>
        {rooms === null ? (
          <div className="rooms-empty muted">Carico le stanze…</div>
        ) : (
          <>
            <div className="room-grid">
              {groups.live.map((r) => (
                <RoomCard key={r.id} room={r} now={now} />
              ))}
              {groups.upcoming.map((r) => (
                <RoomCard key={r.id} room={r} now={now} />
              ))}
              <button className="room-card room-card-new" onClick={quick} disabled={joining}>
                <span className="plus">+</span>
                <b>Arena Rapida</b>
                <span className="muted">15 minuti · 50 posti · parte subito</span>
              </button>
            </div>
            {groups.ended.length > 0 && (
              <>
                <h3 className="rooms-sub">Appena finite</h3>
                <div className="room-grid">
                  {groups.ended.map((r) => (
                    <RoomCard key={r.id} room={r} now={now} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section id="come" className="how">
        <div className="section-head">
          <h2>Come funziona</h2>
        </div>
        <div className="how-grid">
          <div className="how-step">
            <span className="how-n">01</span>
            <b>Entra in una stanza</b>
            <p>Arena Rapida da 15 minuti o stanze ufficiali con premio. Massimo 50 trader.</p>
          </div>
          <div className="how-step">
            <span className="how-n">02</span>
            <b>Trada il mercato vero</b>
            <p>10 SOL finti. Prezzi live da DexScreener, nuovi lanci pump.fun in tempo reale, incolla qualsiasi CA.</p>
          </div>
          <div className="how-step">
            <span className="how-n">03</span>
            <b>Scala la classifica</b>
            <p>La classifica si muove ogni secondo. Allo scadere vince chi ha il saldo più alto.</p>
          </div>
        </div>
        <div className="rules">
          <b>Regole anti-trucco</b>
          <span>Fee 1% a trade</span>
          <span>Slippage calcolato sulla liquidità reale</span>
          <span>Coin sotto $5K di liquidità bloccate</span>
          <span>Max 5 SOL per trade</span>
          <span>Saldo finale = quanto incasseresti vendendo tutto</span>
        </div>
      </section>

      <footer className="foot">
        <Logo />
        <span>Demo · nessun soldo vero · non è consulenza finanziaria</span>
        <span>
          Dati: DexScreener, GeckoTerminal, PumpPortal ·{" "}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
            Charts by TradingView
          </a>
        </span>
      </footer>
    </main>
  );
}

function RoomCard({ room, now }: { room: Room; now: number }) {
  const status = roomStatus(room, now);
  const players = room.players ?? 0;
  const fill = Math.min(100, (players / room.max_players) * 100);
  const time =
    status === "live"
      ? `finisce tra ${fmtClock(Date.parse(room.ends_at) - now)}`
      : status === "upcoming"
        ? `inizia tra ${fmtClock(Date.parse(room.starts_at) - now)}`
        : "finita";
  return (
    <a href={`/r/${room.code}`} className={`room-card st-${status}`}>
      <div className="room-top">
        <span className={`status-pill st-${status}`}>
          {status === "live" && <i className="live-dot" />}
          {status === "live" ? "LIVE" : status === "upcoming" ? "IN ARRIVO" : "FINITA"}
        </span>
        <span className={`chip ${room.kind === "official" ? "chip-gold" : ""}`}>{room.kind === "official" ? "UFFICIALE" : "RAPIDA"}</span>
      </div>
      <b className="room-name">{room.name}</b>
      <div className="room-prize">
        {+room.prize_sol > 0 ? (
          <>
            🏆 <b className="t-gold">{+room.prize_sol} SOL</b>
            {room.prize_note && <small className="muted"> {room.prize_note}</small>}
          </>
        ) : (
          <span className="muted">Allenamento · solo gloria</span>
        )}
      </div>
      <div className="room-bar">
        <i style={{ width: `${fill}%` }} />
      </div>
      <div className="room-meta">
        <span className="mono">
          {players}/{room.max_players} trader
        </span>
        <span className="mono">{time}</span>
      </div>
    </a>
  );
}
