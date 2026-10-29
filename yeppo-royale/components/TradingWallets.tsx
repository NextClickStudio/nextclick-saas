"use client";

import { useCallback, useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { clock } from "@/lib/format";
import { sfx, toast } from "@/lib/fx";
import { rpc } from "@/lib/supabase";
import type { TradingWallet } from "@/lib/types";
import { installedWallets, short, signTradingWallet, solscanAccount } from "@/lib/wallet";
import { useApp } from "./AppProvider";

const APPS = ["Axiom", "GMGN", "Photon", "BullX", "Padre", "pump.fun", "Other"];
const isAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());

async function checkNow(secret: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-real`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action: "twallet_check", secret }),
  });
  const j = (await r.json().catch(() => ({}))) as { verified?: string[]; funded?: Record<string, boolean>; error?: string };
  if (!r.ok) throw new Error(j.error || "Could not check the chain");
  return { verified: j.verified ?? [], funded: j.funded ?? {} };
}

/**
 * Trading apps like Axiom, GMGN or Photon trade from a wallet they made for you, not from Phantom.
 * Link it once and its trades count in every real duel. Pasting an address is not enough (anyone could
 * paste a famous trader's wallet), so one of these has to be true:
 *  - its first funding came from your verified wallet (checked on the chain, nothing to do), or
 *  - you sign with it (if you imported it into Phantom or another wallet), or
 *  - you send a tiny exact amount from it to your verified wallet (your own SOL, it comes straight back).
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
  const [funding, setFunding] = useState<Record<string, "checking" | "no">>({});
  const [signing, setSigning] = useState<string | null>(null);

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
        const { verified: ok, funded } = await checkNow(session.secret);
        setFunding((f) => ({ ...f, ...Object.fromEntries(Object.entries(funded).filter(([, v]) => !v).map(([a]) => [a, "no" as const])) }));
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
    const a = addr.trim();
    try {
      setList(await rpc<TradingWallet[]>("yr_twallet_add", { p_secret: session.secret, p_address: a, p_label: app }));
      setAddr("");
      setOpen(false);
      sfx.go();
      // the free way first: was it funded from the verified wallet?
      setFunding((f) => ({ ...f, [a]: "checking" }));
      void checkNow(session.secret)
        .then(async ({ verified, funded }) => {
          if (verified.includes(a)) {
            sfx.win();
            toast("Linked: it was funded from your verified wallet", "up");
            await load();
          } else if (funded[a] === false) setFunding((f) => ({ ...f, [a]: "no" }));
        })
        .catch(() => setFunding((f) => ({ ...f, [a]: "no" })));
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

  const sign = async (w: TradingWallet) => {
    const wallet = installedWallets()[0];
    if (!wallet) {
      toast("No wallet in this browser. Import the trading wallet into Phantom first.", "down");
      return;
    }
    setSigning(w.address);
    try {
      await signTradingWallet(session.secret, wallet, w.address, w.label);
      sfx.win();
      toast("Trading wallet linked. Its trades count now.", "up");
      await load();
    } catch (e) {
      sfx.error();
      toast(e instanceof Error ? e.message : "Could not sign", "down");
    } finally {
      setSigning(null);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const { verified: ok } = await checkNow(session.secret);
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
          <ol className="tw-ways small">
            <li className={funding[w.address] === "no" ? "off" : ""}>
              <b>Nothing to do</b> if this wallet was first funded from your verified wallet {short(me.wallet)}.{" "}
              {funding[w.address] === "checking" ? (
                <span className="dim">
                  <i className="spinner sm" />
                  reading its history…
                </span>
              ) : funding[w.address] === "no" ? (
                <span className="dim">It was funded from somewhere else.</span>
              ) : null}
            </li>
            <li>
              <b>Sign with it</b> if you imported it into Phantom or another wallet.{" "}
              <button className="tw-copy" onClick={() => sign(w)} disabled={signing === w.address}>
                {signing === w.address ? "Check your wallet…" : "Sign now"}
              </button>
            </li>
            <li>
              <b>Or send a tiny proof:</b> from it in {w.label ?? "your app"}, withdraw exactly{" "}
              <button className="tw-copy mono" onClick={() => copy(w.sol.toFixed(5), "Amount")}>
                {w.sol.toFixed(5)} SOL ⧉
              </button>{" "}
              to{" "}
              <button className="tw-copy mono" onClick={() => copy(me.wallet!, "Address")}>
                {short(me.wallet)} ⧉
              </button>
              . It is your own SOL and lands in your own wallet.
            </li>
          </ol>
          <p className="small dim">Pasting an address is not enough: anyone could paste a famous trader&apos;s wallet.</p>
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
