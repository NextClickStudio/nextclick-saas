"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { centerOf, floatText, sfx, toast } from "@/lib/fx";
import { sol } from "@/lib/format";
import type { Priority } from "@/lib/jup";
import { type Coin, coinOf, getFeed, loadCoin, refreshSolPrice } from "@/lib/pump";
import CoinHead from "./CoinHead";
import { Bags, type Bag, type DuelMark, Holders, Tape } from "./Panels";
import Pulse from "./Pulse";
import { useTermSettings } from "./settings";
import TermChart, { type ChartMark } from "./TermChart";
import TradeBox, { BUY_KEYS, SELL_KEYS } from "./TradeBox";

export type { Bag, DuelMark };
export type TermTrade = (
  side: "buy" | "sell",
  amount: number,
  coin: Coin,
  opts: { slip: number; prio: Priority },
  onStage: (s: string) => void,
) => Promise<{ sol: number; tok: number } | void>;

type Tab = "trades" | "bags" | "holders" | "opp";

/**
 * The yeppo terminal: live coin list, real-time chart, trade box and bags, in one screen.
 * The same terminal runs practice duels (play SOL, filled on the real curve) and real duels
 * (the player's wallet, routed by Jupiter); the parent decides what a trade does.
 */
export default function Terminal({
  mode,
  cash,
  bags,
  marks,
  canTrade,
  locked,
  onTrade,
  hud,
  aside,
  oppPanel,
  focus,
  walletAddr,
  oppAddr,
}: {
  mode: "paper" | "real";
  cash: number | null;
  bags: Bag[];
  marks: DuelMark[];
  canTrade: boolean;
  locked?: string | null;
  onTrade: TermTrade;
  hud?: React.ReactNode;
  aside?: React.ReactNode;
  oppPanel?: React.ReactNode;
  focus?: { mint: string; at: number } | null;
  walletAddr?: string | null;
  oppAddr?: string | null;
}) {
  const [settings, set] = useTermSettings();
  const [sel, setSel] = useState<string | null>(null);
  const [ver, setVer] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trades");
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(0.25);
  const picked = useRef(false);

  const pick = useCallback((mint: string) => {
    picked.current = true;
    setSel(mint);
    setDrawer(false);
  }, []);

  useEffect(() => {
    if (focus?.mint) pick(focus.mint);
  }, [focus, pick]);

  // the first trending coin opens by itself
  const onFirst = useCallback(
    (mint: string) => {
      if (!picked.current) {
        picked.current = true;
        setSel(mint);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshSolPrice();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const coin = sel ? coinOf(sel) : null;
  useEffect(() => {
    if (!sel) return;
    let dead = false;
    loadCoin(sel)
      .then(() => !dead && setVer((v) => v + 1))
      .catch((e) => {
        if (dead) return;
        toast(e instanceof Error ? e.message : "Could not open this coin", "down");
      });
    return getFeed().watch([sel]);
  }, [sel]);

  // re-render on trades of the open coin and of every bag
  const bagKey = bags
    .filter((b) => b.held > 0)
    .map((b) => b.mint)
    .sort()
    .join(",");
  useEffect(() => {
    const mints = new Set([sel, ...bagKey.split(",")].filter(Boolean) as string[]);
    let pending = false;
    const off = getFeed().onTrade((mint) => {
      if (!mints.has(mint) || pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        setVer((v) => v + 1);
      }, 150);
    });
    const unwatch = bagKey ? getFeed().watch(bagKey.split(",")) : () => {};
    return () => {
      off();
      unwatch();
    };
  }, [sel, bagKey]);

  const bag = bags.find((b) => b.mint === sel);
  const held = bag?.held ?? 0;
  const cost = bag && bag.held > 0 ? Math.max(0, bag.cost - bag.got) : 0;
  const entry = bag && bag.held > 0 && cost > 0 ? cost / bag.held : null;
  const chartMarks = useMemo<ChartMark[]>(() => marks.filter((m) => m.mint === sel).map((m) => ({ t: m.t, k: m.k, who: m.who })), [marks, sel]);
  const heldSet = useMemo(() => new Set(bags.filter((b) => b.held > 0).map((b) => b.mint)), [bags]);

  const trade = useCallback(
    async (side: "buy" | "sell", amount: number, target: Coin | null, el?: Element | null) => {
      if (!target || busy || !canTrade) return;
      if (target.graduated) {
        toast("This coin graduated to PumpSwap. Duels count bonding-curve trades only.", "down");
        return;
      }
      if (side === "buy" && cash != null && amount > cash + 1e-9) {
        sfx.error();
        toast(mode === "real" ? "Not enough SOL in your wallet" : "Not enough SOL", "down");
        return;
      }
      setBusy(side === "buy" ? "Buying…" : "Selling…");
      const at = centerOf(el ?? null);
      try {
        const r = await onTrade(side, amount, target, { slip: settings.slip, prio: settings.prio }, (s) => setBusy(s));
        if (side === "buy") {
          sfx.buy();
          floatText(`+${target.sym}`, at.x, at.y - 24, "up");
        } else {
          sfx.coin();
          if (r) floatText(`+${sol(r.sol, 3)} SOL`, at.x, at.y - 24, "up");
        }
      } catch (e) {
        sfx.error();
        toast(e instanceof Error ? e.message : "Trade failed", "down");
      } finally {
        setBusy(null);
      }
    },
    [busy, canTrade, cash, mode, onTrade, settings.slip, settings.prio],
  );

  const quickBuy = useCallback(
    async (mint: string) => {
      const c = coinOf(mint);
      if (sel !== mint) pick(mint);
      if (c.loaded === "none" || !(c.vtok > 0)) await loadCoin(mint).catch(() => null);
      void trade("buy", quick, c, document.querySelector(`[data-q="${mint}"]`));
    },
    [pick, quick, sel, trade],
  );

  // hotkeys: Q W E R buy the presets, A S D F sell them
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const bi = BUY_KEYS.indexOf(k);
      const si = SELL_KEYS.indexOf(k);
      if (bi >= 0) void trade("buy", settings.buy[bi], coin, document.querySelector(`[data-hk="${k}"]`));
      else if (si >= 0 && held > 0) {
        const p = settings.sell[si];
        void trade("sell", p >= 100 ? held : (held * p) / 100, coin, document.querySelector(`[data-hk="${k}"]`));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trade, settings.buy, settings.sell, coin, held]);

  return (
    <div className={`term ${mode}`}>
      {hud}
      <div className="term-grid">
        {drawer && <div className="term-backdrop" onClick={() => setDrawer(false)} />}
        <aside className={`term-pulse ${drawer ? "open" : ""}`}>
          <Pulse
            selected={sel}
            onPick={pick}
            onQuick={quickBuy}
            quick={quick}
            setQuick={setQuick}
            canQuick={canTrade && !busy}
            held={heldSet}
            onFirst={onFirst}
          />
        </aside>
        <section className="term-main">
          <button className="term-coins-btn" onClick={() => setDrawer(!drawer)}>
            {drawer ? "Close coin list" : "☰ Coins"}
          </button>
          {coin ? (
            <>
              <CoinHead coin={coin} version={ver} now={now} tf={settings.tf} unit={settings.unit} onTf={(tf) => set({ tf })} onUnit={(unit) => set({ unit })} />
              <div className="term-chart">
                <TermChart coin={coin} version={ver + coin.version} tf={settings.tf} unit={settings.unit} marks={chartMarks} entry={entry} />
              </div>
              <div className="term-tabs" role="tablist">
                <button className={tab === "trades" ? "on" : ""} onClick={() => setTab("trades")}>
                  Trades
                </button>
                <button className={tab === "bags" ? "on" : ""} onClick={() => setTab("bags")}>
                  Your bags <span className="mono dim">{bags.filter((b) => b.held > 0).length}</span>
                </button>
                <button className={tab === "holders" ? "on" : ""} onClick={() => setTab("holders")}>
                  Holders
                </button>
                {oppPanel && (
                  <button className={`opp-tab ${tab === "opp" ? "on" : ""}`} onClick={() => setTab("opp")}>
                    Opponent
                  </button>
                )}
              </div>
              <div className="term-panel">
                {tab === "trades" && <Tape coin={coin} version={ver + coin.version} marks={marks} me={walletAddr} opp={oppAddr} />}
                {tab === "bags" && (
                  <Bags
                    bags={bags}
                    onPick={pick}
                    canTrade={canTrade && !busy}
                    onSellAll={(m) => {
                      const b = bags.find((x) => x.mint === m);
                      if (b) void trade("sell", b.held, coinOf(m));
                    }}
                    empty={mode === "real" ? "No bags bought during this duel yet." : "No bags yet. Buy something from the list on the left."}
                  />
                )}
                {tab === "holders" && <Holders coin={coin} me={walletAddr} />}
                {tab === "opp" && oppPanel}
              </div>
            </>
          ) : (
            <div className="term-empty">
              <i className="spinner" />
              <p className="small muted">Loading live pump.fun launches…</p>
            </div>
          )}
        </section>
        <aside className="term-side">
          <TradeBox
            mode={mode}
            coin={coin}
            cash={cash}
            held={held}
            cost={cost}
            canTrade={canTrade}
            locked={locked}
            busy={busy}
            settings={settings}
            set={set}
            onTrade={(side, amount, el) => void trade(side, amount, coin, el)}
          />
          {aside}
        </aside>
      </div>
    </div>
  );
}
