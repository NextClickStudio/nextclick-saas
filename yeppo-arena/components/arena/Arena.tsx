"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { arena, loadSession, readLocal, saveSession, supabase, writeLocal } from "@/lib/supabase";
import {
  connectLaunches,
  fetchCoins,
  fetchFreshMints,
  fetchHotMints,
  getSolUsd,
  type Coin,
  type Launch,
} from "@/lib/market";
import { heldMints, rankPlayers } from "@/lib/arena";
import { centerOf, confetti, edgeGlow, floatText, sfx, toast } from "@/lib/fx";
import { fmtNum, fmtSol, fmtUsd } from "@/lib/format";
import { roomStatus, type Fill, type Player, type Room, type RoomStatus, type Session, type Trade } from "@/lib/types";
import TopBar from "./TopBar";
import CoinList from "./CoinList";
import CoinHeader from "./CoinHeader";
import PriceChart from "./PriceChart";
import TradePanel from "./TradePanel";
import Leaderboard from "./Leaderboard";
import Feed from "./Feed";
import { Countdown, EndScreen, HelpStrip, JoinGate } from "./Overlays";

const PLAYER_COLS = "id,room_id,nickname,color,cash,positions,realized,trades_count,final_equity,final_rank,joined_at,updated_at";

type Tab = "coins" | "chart" | "board";

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

export default function Arena({ code }: { code: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [missing, setMissing] = useState(false);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [coins, setCoins] = useState<Record<string, Coin>>({});
  const [hot, setHot] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("chart");
  const [joinOpen, setJoinOpen] = useState(false);
  const [endClosed, setEndClosed] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  const mergeCoins = useCallback((c: Record<string, Coin>) => {
    if (Object.keys(c).length) setCoins((prev) => ({ ...prev, ...c }));
  }, []);

  // --- room bootstrap ---
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("arena_rooms").select("*").eq("code", code).maybeSingle();
      if (!alive) return;
      if (!data) {
        setMissing(true);
        return;
      }
      const r = data as Room;
      setRoom(r);
      const s = loadSession(code);
      setSession(s);
      if (!s && Date.now() < Date.parse(r.ends_at)) setJoinOpen(true);
      setHelp(!readLocal("yeppo:help-seen", false));
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  const roomId = room?.id;

  const loadPlayers = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase.from("arena_players").select(PLAYER_COLS).eq("room_id", roomId);
    if (data) setPlayers(Object.fromEntries((data as Player[]).map((p) => [p.id, p])));
  }, [roomId]);

  // --- realtime room state ---
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    loadPlayers();
    supabase
      .from("arena_trades")
      .select("*")
      .eq("room_id", roomId)
      .order("id", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (alive && data) setTrades(data as Trade[]);
      });
    const channel = supabase
      .channel(`arena:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "arena_players", filter: `room_id=eq.${roomId}` }, (msg) => {
        const p = msg.new as Player;
        if (p?.id) setPlayers((prev) => ({ ...prev, [p.id]: p }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "arena_trades", filter: `room_id=eq.${roomId}` }, (msg) => {
        const t = msg.new as Trade;
        setTrades((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev].slice(0, 80)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "arena_rooms", filter: `id=eq.${roomId}` }, (msg) => {
        setRoom(msg.new as Room);
      })
      .subscribe();
    const safety = setInterval(loadPlayers, 15000);
    return () => {
      alive = false;
      clearInterval(safety);
      supabase.removeChannel(channel);
    };
  }, [roomId, loadPlayers]);

  // --- clock ---
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // --- market lists (hot + fresh), refreshed every 30s ---
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!visible()) return;
      const [h, f] = await Promise.all([fetchHotMints().catch(() => []), fetchFreshMints().catch(() => [])]);
      const data = await fetchCoins([...h, ...f]).catch(() => ({}) as Record<string, Coin>);
      if (!alive) return;
      mergeCoins(data);
      setHot(h.filter((m) => data[m]));
      setFresh(f.filter((m) => data[m]));
      setSelected((s) => s ?? readLocal<string | null>("yeppo:last-coin", null) ?? h.find((m) => data[m]) ?? null);
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mergeCoins]);

  // --- live pump.fun launches ---
  useEffect(
    () => connectLaunches((l) => setLaunches((prev) => [l, ...prev.filter((x) => x.mint !== l.mint)].slice(0, 40))),
    [],
  );

  // --- selected coin: 2s live price ---
  useEffect(() => {
    if (!selected) return;
    writeLocal("yeppo:last-coin", selected);
    let alive = true;
    const tick = async () => {
      if (!visible()) return;
      const d = await fetchCoins([selected]).catch(() => null);
      if (alive && d) mergeCoins(d);
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [selected, mergeCoins]);

  // --- every coin held in the room: 6s, for live equity/leaderboard ---
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!visible()) return;
      const mints = heldMints(Object.values(playersRef.current));
      if (!mints.length) return;
      const d = await fetchCoins(mints).catch(() => null);
      if (alive && d) mergeCoins(d);
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mergeCoins]);

  // --- derived ---
  const status = room ? roomStatus(room, now) : "upcoming";
  const playerList = useMemo(() => Object.values(players), [players]);
  const ranked = useMemo(
    () => (room ? rankPlayers(playerList, coins, +room.start_balance, room.finalized) : []),
    [playerList, coins, room],
  );
  const meId = session?.playerId ?? null;
  const me = meId ? (players[meId] ?? null) : null;
  const myRank = meId ? (ranked.find((r) => r.player.id === meId) ?? null) : null;
  const coin = selected ? (coins[selected] ?? null) : null;
  const launch = selected ? launches.find((l) => l.mint === selected) : undefined;
  const position = me && selected ? me.positions?.[selected] : undefined;
  const held = useMemo(() => new Set(Object.keys(me?.positions ?? {})), [me]);
  const myMarks = useMemo(
    () =>
      trades
        .filter((t) => t.player_id === meId && t.mint === selected)
        .map((t) => ({ time: Math.floor(Date.parse(t.created_at) / 1000), side: t.side })),
    [trades, meId, selected],
  );
  const entryValue = useMemo(() => {
    if (!coin || !position || !(position.qty > 0)) return null;
    const avgUsd = (position.cost / position.qty) * getSolUsd();
    return coin.supply > 0 ? avgUsd * coin.supply : avgUsd;
  }, [coin, position]);

  // --- status transitions: GO! / last-10s ticks / finalize ---
  const prevStatus = useRef<RoomStatus | null>(null);
  useEffect(() => {
    if (!roomId) return;
    if (prevStatus.current === "upcoming" && status === "live") {
      sfx.go();
      toast("GO! L'arena è aperta 🚀", "up");
      confetti();
    }
    prevStatus.current = status;
  }, [status, roomId]);

  const remaining = room ? Date.parse(room.ends_at) - now : 0;
  useEffect(() => {
    if (status === "live" && remaining <= 10_000 && remaining > 0) sfx.tick();
  }, [status, remaining]);

  const finalizing = useRef(false);
  useEffect(() => {
    if (!room || room.finalized || status !== "ended" || finalizing.current) return;
    finalizing.current = true;
    arena<{ room: Room }>("finalize", { room_id: room.id })
      .then(({ room: r }) => {
        if (r) setRoom(r);
        loadPlayers();
      })
      .catch(() => setTimeout(() => (finalizing.current = false), 4000));
  }, [room, status, now, loadPlayers]);

  const lastRankFx = useRef({ rank: 0, at: 0 });
  useEffect(() => {
    if (!myRank || status !== "live") return;
    const prev = lastRankFx.current;
    if (prev.rank && myRank.rank < prev.rank && Date.now() - prev.at > 8000) {
      sfx.rank();
      toast(`▲ Sei salito al #${myRank.rank}`, "up");
      lastRankFx.current = { rank: myRank.rank, at: Date.now() };
    } else {
      lastRankFx.current = { ...prev, rank: myRank.rank };
    }
  }, [myRank, status]);

  // --- actions ---
  async function join(nickname: string) {
    const res = await arena<{ player: Player; secret: string }>("join", { code, nickname });
    const s = { playerId: res.player.id, secret: res.secret, nickname: res.player.nickname };
    saveSession(code, s);
    writeLocal("yeppo:nick", nickname);
    setSession(s);
    setPlayers((p) => ({ ...p, [res.player.id]: res.player }));
    setJoinOpen(false);
    sfx.go();
    confetti();
    toast(`Benvenuto ${res.player.nickname}: hai ${+res.player.cash} SOL finti 🚀`, "up");
  }

  async function trade(side: "buy" | "sell", value: number, el: HTMLElement | null) {
    if (!session) {
      setJoinOpen(true);
      return;
    }
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await arena<{ player: Player; fill: Fill }>("trade", {
        player_id: session.playerId,
        secret: session.secret,
        mint: selected,
        side,
        ...(side === "buy" ? { amount: value } : { pct: value }),
      });
      setPlayers((p) => ({ ...p, [res.player.id]: res.player }));
      const f = res.fill;
      const { x, y } = centerOf(el);
      if (side === "buy") {
        sfx.buy();
        floatText(`+${fmtNum(f.tokens)} $${f.symbol}`, x, y - 36, "up");
        toast(`🟢 Comprato ${fmtSol(f.sol)} SOL di $${f.symbol} @ ${fmtUsd(f.mcap_usd)}`, "up");
      } else {
        const pnl = f.pnl_sol ?? 0;
        const pct = f.sol - pnl > 0 ? (pnl / (f.sol - pnl)) * 100 : 0;
        if (pnl >= 0) {
          sfx.win();
          confetti(x, y);
          if (pct >= 50) setTimeout(() => confetti(), 250);
          edgeGlow("up");
          floatText(`${fmtSol(pnl, true)} SOL`, x, y - 36, "up");
          toast(`💰 Chiuso $${f.symbol}: ${fmtSol(pnl, true)} SOL (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%)`, "up");
        } else {
          sfx.lose();
          edgeGlow("down");
          floatText(`${fmtSol(pnl, true)} SOL`, x, y - 36, "down");
          toast(`🩸 Chiuso $${f.symbol}: ${fmtSol(pnl, true)} SOL (${pct.toFixed(0)}%)`, "down");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      sfx.error();
      toast(msg, "down");
      if (msg === "Sessione non valida") {
        saveSession(code, null);
        setSession(null);
        setJoinOpen(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function newQuick() {
    try {
      const { room: r } = await arena<{ room: Room }>("quick");
      router.push(`/r/${r.code}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Errore", "down");
    }
  }

  const select = useCallback((mint: string) => {
    setSelected(mint);
    setTab("chart");
  }, []);

  if (missing) {
    return (
      <div className="splash">
        <b>Stanza non trovata</b>
        <span className="muted">Il codice #{code} non esiste o è stato rimosso.</span>
        <a className="btn-buy" href="/">
          Torna alla lobby
        </a>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="splash">
        <i className="spinner" />
        <span className="muted">Entro nell&apos;arena #{code}…</span>
      </div>
    );
  }

  return (
    <div className="arena" data-tab={tab}>
      <TopBar
        room={room}
        status={status}
        now={now}
        playersCount={playerList.length}
        me={myRank}
        onJoin={() => setJoinOpen(true)}
      />
      {help && (
        <HelpStrip
          onClose={() => {
            setHelp(false);
            writeLocal("yeppo:help-seen", true);
          }}
        />
      )}
      <aside className="pane pane-coins">
        <CoinList
          hot={hot}
          fresh={fresh}
          launches={launches}
          coins={coins}
          selected={selected}
          held={held}
          now={now}
          onSelect={select}
          onCoins={mergeCoins}
        />
      </aside>
      <main className="pane pane-main">
        <CoinHeader coin={coin} mint={selected} launch={launch} now={now} />
        <PriceChart coin={coin} mint={selected} marks={myMarks} entry={entryValue} />
        <TradePanel
          coin={coin}
          mint={selected}
          me={me}
          status={status}
          busy={busy}
          startsIn={Date.parse(room.starts_at) - now}
          onTrade={trade}
          onJoin={() => setJoinOpen(true)}
          coins={coins}
          onSelect={select}
        />
      </main>
      <aside className="pane pane-side">
        <Leaderboard ranked={ranked} meId={meId} maxPlayers={room.max_players} finalized={room.finalized} />
        <Feed trades={trades} meId={meId} now={now} onSelect={select} />
      </aside>
      <nav className="tabbar">
        <button className={tab === "coins" ? "on" : ""} onClick={() => setTab("coins")}>
          Coin
        </button>
        <button className={tab === "chart" ? "on" : ""} onClick={() => setTab("chart")}>
          Trade
        </button>
        <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>
          Classifica
        </button>
      </nav>
      {status === "live" && remaining <= 10_000 && remaining > 0 && <Countdown ms={remaining} />}
      {joinOpen && status !== "ended" && <JoinGate room={room} onJoin={join} onClose={() => setJoinOpen(false)} />}
      {status === "ended" && !endClosed && (
        <EndScreen room={room} ranked={ranked} meId={meId} onQuick={newQuick} onClose={() => setEndClosed(true)} />
      )}
    </div>
  );
}
