"use client";

import { useCallback, useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { clock } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { rpc } from "@/lib/supabase";
import type { TradingWallet } from "@/lib/types";
import { short, solscanAccount } from "@/lib/wallet";
import { useApp } from "./AppProvider";

const APPS = ["Axiom", "GMGN", "Photon", "BullX", "Padre", "pump.fun", "Other"];
const isAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());

async function checkNow(secret: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-real`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action: "twallet_check", secret }),
  });
  const j = (await r.json().catch(() => ({}))) as { verified?: string[]; error?: string };
  if (!r.ok) throw new Error(j.error || "Could not check the chain");
  return j.verified ?? [];
}

/**
 * Trading apps like Axiom, GMGN or Photon trade from a wallet they made for you, not from Phantom.
 * Link it once: send a tiny, exact amount from it to your verified wallet (your own money, it lands
 * in your own wallet) and its trades count in every real duel.
 */
export default function TradingWallets({ suggest, compact }: { suggest?: string | null; compact?: boolean }) {
  const { me, session } = useApp();
  const [list, setList] = useState<TradingWallet[] | null>(null);
  const [open, setOpen] = useState(!!suggest);
  const [addr, setAddr] = useState("");
  const [app, setApp] = useState(suggest && APPS.includes(suggest) ? suggest : "Axiom");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const l = await rpc<TradingWallet[]>("yr_twallets", { p_secret: session.secret });
      setList(l);
      // the suggested app is already linked: nothing to ask
      if (suggest && l.some((w) => w.status === "ok" && w.label === suggest)) setOpen(false);
    } catch {
      setList([]);
    }
  }, [session, suggest]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = (list ?? []).filter((w) => w.status === "pending" && w.expires > now);
  const linked = (list ?? []).filter((w) => w.status === "ok");

  // while a proof is pending, look for it on-chain every few seconds
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const hasPending = pending.length > 0;
  useEffect(() => {
    if (!hasPending || !session) return;
    const t = setInterval(async () => {
      try {
        const ok = await checkNow(session.secret);
        if (ok.length) {
          sfx.win();
          toast("Trading wallet linked. Its trades count now.", "up");
          await load();
        }
      } catch {
        /* the next round will do */
      }
    }, 7000);
    return () => clearInterval(t);
  }, [hasPending, session, load]);

  if (!session || !me?.wallet) return null;

  const add = async () => {
    if (!isAddr(addr)) {
      toast("Paste the wallet address from your trading app", "down");
      return;
    }
    setBusy(true);
    try {
      setList(await rpc<TradingWallet[]>("yr_twallet_add", { p_secret: session.secret, p_address: addr.trim(), p_label: app }));
      setAddr("");
      setOpen(false);
      sfx.go();
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not add the wallet", "down");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: string) => {
    try {
      setList(await rpc<TradingWallet[]>("yr_twallet_remove", { p_secret: session.secret, p_address: a }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove the wallet", "down");
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const ok = await checkNow(session.secret);
      if (ok.length) {
        sfx.win();
        toast("Trading wallet linked. Its trades count now.", "up");
      } else toast("Not on-chain yet. It usually shows up a few seconds after you send it.", "info");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not check the chain", "down");
    } finally {
      setChecking(false);
    }
  };

  const copy = (s: string, what: string) => navigator.clipboard?.writeText(s).then(() => toast(`${what} copied`, "info"));
  const missing = !!suggest && list != null && !linked.some((w) => w.label === suggest) && !pending.some((w) => w.label === suggest);

  return (
    <div className={`twallets ${compact ? "compact" : ""} ${missing ? "warn" : ""}`}>
      {missing && (
        <p className="small t-warn tw-warn">
          {suggest} trades from a wallet it made for you, not from your verified wallet. Link it here or your {suggest} trades will not count.
        </p>
      )}
      <div className="tw-head">
        <span className="lbl">Trading wallets</span>
        {!open && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            + Link a trading app
          </button>
        )}
      </div>
      {!linked.length && !pending.length && !open && (
        <p className="small muted">Axiom, GMGN, Photon, BullX and Padre trade from a wallet they made for you. Link it so those trades count.</p>
      )}
      {linked.map((w) => (
        <div key={w.address} className="tw-row ok">
          <span className="chip chip-up">✓ {w.label ?? "Linked"}</span>
          <a className="mono small" href={solscanAccount(w.address)} target="_blank" rel="noreferrer">
            {short(w.address)} ↗
          </a>
          <button className="tw-x" title="Unlink" onClick={() => remove(w.address)}>
            ×
          </button>
        </div>
      ))}
      {pending.map((w) => (
        <div key={w.address} className="tw-proof">
          <div className="tw-row">
            <span className="chip chip-warn">{w.label ?? "Wallet"} · waiting</span>
            <span className="mono small">{short(w.address)}</span>
            <span className="mono small dim">{clock(w.expires - now)}</span>
            <button className="tw-x" title="Cancel" onClick={() => remove(w.address)}>
              ×
            </button>
          </div>
          <p className="small">
            From this wallet in {w.label ?? "your app"}, withdraw exactly{" "}
            <button className="tw-copy mono" onClick={() => copy(w.sol.toFixed(5), "Amount")}>
              {w.sol.toFixed(5)} SOL ⧉
            </button>{" "}
            to your verified wallet{" "}
            <button className="tw-copy mono" onClick={() => copy(me.wallet!, "Address")}>
              {short(me.wallet)} ⧉
            </button>
          </p>
          <p className="small dim">It is your own SOL and lands in your own wallet. Only the owner of a wallet can send from it, so this proves it is yours.</p>
          <div className="row-btns">
            <button className="btn btn-sm" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "I sent it, check now"}
            </button>
            <span className="small dim">
              <i className="spinner sm" /> watching the chain
            </span>
          </div>
        </div>
      ))}
      {open && (
        <div className="tw-add">
          <div className="seg sm tw-apps">
            {APPS.map((a) => (
              <button key={a} className={app === a ? "on" : ""} onClick={() => setApp(a)}>
                {a}
              </button>
            ))}
          </div>
          <div className="copy">
            <input
              className="input mono"
              placeholder={`Your ${app === "Other" ? "trading" : app} wallet address`}
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <button className="btn btn-primary" onClick={add} disabled={busy}>
              {busy ? "…" : "Link"}
            </button>
          </div>
          <p className="small dim">
            In {app === "Other" ? "your app" : app}, open your wallet and copy its address. yeppo never asks for keys and never moves funds.
            <button className="link-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
