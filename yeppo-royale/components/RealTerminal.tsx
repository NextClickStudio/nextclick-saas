"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clock, sol } from "@/lib/format";
import { toast } from "@/lib/fx";
import { connectWallet, solBalance, swap, tokenBalance } from "@/lib/jup";
import { coinOf } from "@/lib/pump";
import { installedWallets, onWalletsChange, phantomBrowseLink, short, solscanTx, walletById } from "@/lib/wallet";
import type { RealDuel } from "@/lib/types";
import { useApp } from "./AppProvider";
import Terminal, { type Bag, type DuelMark, type TermTrade } from "./term/Terminal";

type RT = RealDuel["trades"][number];

/** the yeppo terminal wired to the player's own wallet for a real duel */
export default function RealTerminal({ d, sNow, hud, reload }: { d: RealDuel; sNow: number; hud: React.ReactNode; reload: () => void }) {
  const { me } = useApp();
  const [addr, setAddr] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [bal, setBal] = useState<number | null>(null);
  const [local, setLocal] = useState<RT[]>([]);
  const [focus, setFocus] = useState<{ mint: string; at: number } | null>(null);
  const [wallets, setWallets] = useState<ReturnType<typeof installedWallets>>([]);

  useEffect(() => {
    const pick = () => setWallets(installedWallets());
    pick();
    const off = onWalletsChange(pick);
    const w = walletById(null);
    void connectWallet(w, false).then((a) => {
      if (!a || !w) return;
      setAddr(a);
      setWalletId(w.id);
    });
    return off;
  }, []);

  const refreshBal = useCallback(() => {
    if (addr) void solBalance(addr).then(setBal).catch(() => null);
  }, [addr]);
  useEffect(() => {
    refreshBal();
    const t = setInterval(refreshBal, 15_000);
    return () => clearInterval(t);
  }, [refreshBal]);

  // the chain tracker catches up within seconds; until then our own swaps show from their receipts
  useEffect(() => {
    setLocal((l) => l.filter((x) => !d.trades.some((t) => t[6] === x[6])));
  }, [d.trades]);
  const trades = useMemo(() => [...d.trades, ...local], [d.trades, local]);
  const slot = d.me ?? 1;

  const bags = useMemo<Bag[]>(() => {
    const m = new Map<string, Bag>();
    for (const [s, mint, k, solAmt, tok] of trades) {
      if (s !== slot) continue;
      const c = coinOf(mint);
      const b = m.get(mint) ?? { mint, sym: d.mints[mint]?.symbol?.replace(/^\$/, "").slice(0, 12) || c.sym, uri: c.meta.uri, held: 0, cost: 0, got: 0, n: 0 };
      if (k === 1) {
        b.held += tok;
        b.cost += solAmt;
      } else {
        b.held = Math.max(0, b.held - tok);
        b.got += solAmt;
      }
      b.n++;
      m.set(mint, b);
    }
    return [...m.values()];
  }, [trades, slot, d.mints]);

  const marks = useMemo<DuelMark[]>(
    () => trades.map(([s, mint, k, solAmt, tok, at]) => ({ mint, t: at, k: (k === 1 ? 1 : 2) as 1 | 2, who: (s === slot ? "me" : "opp") as DuelMark["who"], sol: solAmt, tok, px: tok > 0 ? solAmt / tok : 0 })),
    [trades, slot],
  );

  const pre = d.start != null && sNow < d.start;
  const ended = d.status !== "live" || (d.end != null && sNow > d.end);
  const wrong = !!addr && !!me?.wallet && addr !== me.wallet;
  const canTrade = d.me != null && !!addr && !wrong && !pre && !ended;
  const locked =
    d.me == null
      ? "Spectating"
      : !addr
        ? "Connect your wallet"
        : wrong
          ? "Switch to your verified wallet"
          : pre
            ? `Starts in ${clock(d.start! - sNow)}`
            : ended
              ? "Time is up"
              : null;

  const onTrade = useCallback<TermTrade>(
    async (side, amount, coin, { slip, prio }, onStage) => {
      if (!addr) throw new Error("Connect your wallet first");
      let raw: bigint;
      let decimals = 6;
      if (side === "buy") raw = BigInt(Math.round(amount * 1e9));
      else {
        const tb = await tokenBalance(addr, coin.mint);
        decimals = tb.decimals;
        raw = BigInt(Math.floor(amount * 10 ** decimals));
        if (raw > tb.raw) raw = tb.raw;
        if (raw <= 0n) throw new Error(`No ${coin.sym} in this wallet`);
      }
      const r = await swap({
        side,
        mint: coin.mint,
        amountRaw: raw,
        slipPct: slip,
        priority: prio,
        owner: addr,
        walletId,
        onStage: (s) => onStage(s === "quote" ? "Routing…" : s === "sign" ? "Approve in your wallet…" : s === "send" ? "Sending…" : "Confirming…"),
      });
      const solAmt = side === "buy" ? amount : r.outAmount / 1e9;
      const tok = side === "buy" ? r.outAmount / 10 ** decimals : Number(raw) / 10 ** decimals;
      setLocal((l) => [...l, [slot, coin.mint, side === "buy" ? 1 : 2, solAmt, tok, Date.now(), r.signature]]);
      toast(`${side === "buy" ? "Bought" : "Sold"} on-chain · ${sol(solAmt, 3)} SOL · ${r.route}`, side === "buy" ? "up" : "gold");
      refreshBal();
      setTimeout(reload, 4000);
      return { sol: solAmt, tok };
    },
    [addr, walletId, slot, refreshBal, reload],
  );

  const opp = slot === 1 ? d.p2 : d.p1;
  const oppTrades = [...trades].filter((t) => t[0] !== slot).sort((a, b) => b[5] - a[5]);

  const walletBox = (
    <div className="wallet-box">
      <div className="panel-head">
        <span className="lbl">Your wallet</span>
        {addr && <span className="mono small dim">{short(addr)}</span>}
      </div>
      {addr ? (
        wrong ? (
          <p className="small t-warn">
            Connected {short(addr)}, but your verified wallet is {short(me?.wallet)}. Only trades from the verified wallet count. Switch account in your wallet.
          </p>
        ) : (
          <p className="small muted">
            <b className="mono">{bal == null ? "…" : `${sol(bal, 3)} SOL`}</b> · trades are signed by your wallet and counted on-chain.
          </p>
        )
      ) : wallets.length ? (
        <div className="wallet-btns">
          {wallets.map((w) => (
            <button
              key={w.id}
              className="btn btn-primary btn-sm"
              onClick={async () => {
                try {
                  const a = await connectWallet(w, true);
                  if (!a) throw new Error(`${w.name} did not share an address`);
                  setAddr(a);
                  setWalletId(w.id);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "The wallet did not connect", "down");
                }
              }}
            >
              {w.icon && <img className="wallet-ico" src={w.icon} alt="" />}
              Connect {w.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted">
          No wallet in this browser.{" "}
          <a className="t-up" href={phantomBrowseLink(`/real/${d.code}`)}>
            Open yeppo in Phantom ↗
          </a>
        </p>
      )}
    </div>
  );

  const oppPanel = (
    <div className="opp-panel">
      <div className="panel-head">
        <span className="lbl">{opp?.name ?? "Opponent"}&apos;s trades</span>
        <span className="mono small dim">{opp?.wallet ? short(opp.wallet) : ""}</span>
      </div>
      <div className="moves">
        {oppTrades.slice(0, 12).map((t) => (
          <div key={`${t[6]}-${t[2]}`} className={`move ${t[2] === 1 ? "b" : "s"} link`} role="button" onClick={() => setFocus({ mint: t[1], at: Date.now() })}>
            <span className="mono">{t[2] === 1 ? "BUY" : "SELL"}</span>
            <b className="mono">{sol(t[3], 3)}</b>
            <span className="mono dim">${(d.mints[t[1]]?.symbol ?? coinOf(t[1]).sym).replace(/^\$/, "").slice(0, 8)}</span>
            <a className="mono dim" href={solscanTx(t[6])} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              tx ↗
            </a>
          </div>
        ))}
        {!oppTrades.length && <p className="small dim">No trades yet. Click any of theirs to open the coin.</p>}
      </div>
    </div>
  );

  return (
    <Terminal
      mode="real"
      cash={bal}
      bags={bags}
      marks={marks}
      canTrade={canTrade}
      locked={locked}
      onTrade={onTrade}
      hud={hud}
      aside={
        <>
          {walletBox}
          <div className="aside-opp">{oppPanel}</div>
        </>
      }
      oppPanel={oppPanel}
      focus={focus}
      walletAddr={addr}
      oppAddr={opp?.wallet ?? null}
    />
  );
}
