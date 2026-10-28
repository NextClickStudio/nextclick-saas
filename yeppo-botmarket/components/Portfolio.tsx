"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/supabase";
import { usePrices } from "@/lib/market";
import { botLive } from "@/lib/bots";
import { ptsForShares } from "@/lib/curve";
import { DAILY_PTS } from "@/lib/config";
import { compact, duration, pct, pts, sharePrice, signed, tone } from "@/lib/format";
import { centerOf, confetti, floatText, sfx, toast } from "@/lib/fx";
import { useApp } from "./AppProvider";
import { BotAvatar, PositionCell, Stat } from "./ui";

const CLAIM_MS = 20 * 3600_000;

export default function Portfolio() {
  const router = useRouter();
  const { session, me, holdings, bots, openAuth, refreshMe, logout } = useApp();
  const prices = usePrices();
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(
    () =>
      Object.values(holdings)
        .map((h) => {
          const b = bots[h.bot_id];
          if (!b) return null;
          const value = ptsForShares(h.shares, b.supply);
          return { h, b, value, pnl: value - h.cost, pnlPct: h.cost > 0 ? (value / h.cost - 1) * 100 : 0 };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.value - a.value),
    [holdings, bots],
  );
  const mine = useMemo(() => Object.values(bots).filter((b) => me && b.creator_id === me.id), [bots, me]);

  if (!session) {
    return (
      <main className="page center">
        <h1>Your portfolio</h1>
        <p className="muted">Sign up to get 10,000 free pts and start backing bots.</p>
        <div className="row-gap">
          <button className="btn btn-primary" onClick={() => openAuth("signup")}>
            Create account
          </button>
          <button className="btn btn-ghost" onClick={() => openAuth("login")}>
            Log in with key
          </button>
        </div>
      </main>
    );
  }

  const value = rows.reduce((s, r) => s + r.value, 0);
  const dividends = rows.reduce((s, r) => s + r.h.dividends, 0);
  const nextClaim = me?.last_claim_at ? Date.parse(me.last_claim_at) + CLAIM_MS : 0;
  const canClaim = !nextClaim || nextClaim <= now;

  async function claim(e: React.MouseEvent<HTMLButtonElement>) {
    if (!session || claiming) return;
    const el = e.currentTarget;
    setClaiming(true);
    try {
      await rpc("bm_claim", { p_secret: session.secret });
      const { x, y } = centerOf(el);
      sfx.win();
      confetti(x, y);
      floatText(`+${pts(DAILY_PTS)} pts`, x, y - 30, "gold");
      await refreshMe();
    } catch (err) {
      sfx.error();
      toast(err instanceof Error ? err.message : "Claim failed", "down");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="page portfolio">
      <div className="pf-head">
        <div>
          <h1>@{me?.handle ?? session.handle}</h1>
          <p className="muted">Net worth counts your pts plus what your shares would sell for right now.</p>
        </div>
        <button className={`btn ${canClaim ? "btn-gold pulse" : "btn-ghost"}`} disabled={!canClaim || claiming} onClick={claim}>
          {canClaim ? `Claim daily ${pts(DAILY_PTS)} pts` : `Next claim in ${duration(nextClaim - now)}`}
        </button>
      </div>

      <div className="panel statgrid statgrid-4 pf-stats">
        <Stat label="Balance">{pts(me?.balance)}</Stat>
        <Stat label="Shares value">{pts(value)}</Stat>
        <Stat label="Net worth" tone="up">
          {pts((me?.balance ?? 0) + value)}
        </Stat>
        <Stat label="Dividends earned" tone="gold">
          {pts(dividends)}
        </Stat>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="lbl">Holdings · {rows.length}</span>
        </div>
        {rows.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Position</th>
                  <th className="num">Shares</th>
                  <th className="num c-hide">Price</th>
                  <th className="num c-hide">Cost</th>
                  <th className="num">Value</th>
                  <th className="num">P&amp;L</th>
                  <th className="num">Dividends</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const live = botLive(r.b, prices);
                  return (
                    <tr key={r.b.id} onClick={() => router.push(`/bot/${r.b.ticker}`)}>
                      <td>
                        <div className="botcell">
                          <BotAvatar bot={r.b} />
                          <div>
                            <b className="botname">{r.b.name}</b>
                            <span className="botmeta mono">${r.b.ticker}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <PositionCell bot={r.b} open={live.open} />
                      </td>
                      <td className="num mono">{pts(r.h.shares)}</td>
                      <td className="num mono c-hide">{sharePrice(live.price)}</td>
                      <td className="num mono c-hide">{pts(r.h.cost)}</td>
                      <td className="num mono">{pts(r.value)}</td>
                      <td className={`num mono t-${tone(r.pnl)}`}>
                        {signed(r.pnl)} <small>{pct(r.pnlPct, 1)}</small>
                      </td>
                      <td className="num mono t-gold">{pts(r.h.dividends)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            No shares yet. <Link href="/">Find a bot</Link> and buy early — the curve rewards first movers.
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="lbl">Your bots · {mine.length}/5</span>
          <Link href="/launch" className="btn btn-ghost btn-xs">
            Launch a bot
          </Link>
        </div>
        {mine.length ? (
          <div className="mybots">
            {mine.map((b) => {
              const live = botLive(b, prices);
              return (
                <Link key={b.id} href={`/bot/${b.ticker}`} className="mybot">
                  <BotAvatar bot={b} />
                  <div>
                    <b>{b.name}</b>
                    <span className="mono muted">${b.ticker}</span>
                  </div>
                  <span className={`mono t-${tone(live.ret)}`}>{pct(live.ret)}</span>
                  <span className="mono muted">{b.holders} holders</span>
                  <span className="mono muted">mcap {compact(live.mcap)}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty">You haven&apos;t launched a bot yet. Creators earn 1% of every share trade.</div>
        )}
      </div>

      <div className="panel account">
        <div className="panel-head">
          <span className="lbl">Account key</span>
        </div>
        <p className="muted small">This key is your login. Save it to use your account on another device. Anyone with it controls your account.</p>
        <div className="keyrow">
          <input className="input mono" readOnly value={showKey ? session.secret : "•".repeat(32)} onFocus={(e) => showKey && e.target.select()} />
          <button className="btn btn-ghost btn-xs" onClick={() => setShowKey((s) => !s)}>
            {showKey ? "Hide" : "Reveal"}
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              navigator.clipboard?.writeText(session.secret).then(
                () => toast("Key copied", "info"),
                () => setShowKey(true),
              )
            }
          >
            Copy
          </button>
          <button className="btn btn-ghost btn-xs" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}
