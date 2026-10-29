"use client";

import { useEffect, useState } from "react";
import { installedWallets, onWalletsChange, phantomBrowseLink, short, solscanAccount, verifyWallet, type Wallet } from "@/lib/wallet";
import { sfx, toast } from "@/lib/fx";
import { useApp } from "./AppProvider";

/** Link a wallet by signing a free message. Shows the linked wallet once verified. */
export default function WalletConnect({ compact }: { compact?: boolean }) {
  const { me, session, refreshMe, openCreator } = useApp();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [change, setChange] = useState(false);

  useEffect(() => {
    // extensions inject themselves a moment after load
    const pick = () => setWallets(installedWallets());
    pick();
    const off = onWalletsChange(pick);
    const t = setTimeout(pick, 600);
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  if (!session || !me) {
    return (
      <div className="wallet-box">
        <p className="muted small">Create a free profile first. It takes 10 seconds.</p>
        <button className="btn btn-primary" onClick={() => openCreator(true)}>
          Create profile
        </button>
      </div>
    );
  }

  if (me.wallet && !change) {
    return (
      <div className="wallet-box ok">
        <div className="wallet-line">
          <span className="chip chip-up">✓ Verified</span>
          <a className="mono" href={solscanAccount(me.wallet)} target="_blank" rel="noreferrer">
            {short(me.wallet)} ↗
          </a>
        </div>
        {!compact && (
          <button className="btn btn-ghost btn-sm" onClick={() => setChange(true)}>
            Use another wallet
          </button>
        )}
      </div>
    );
  }

  const go = async (w: Wallet) => {
    setBusy(w.id);
    setErr(null);
    try {
      await verifyWallet(session.secret, w);
      await refreshMe();
      sfx.win();
      toast("Wallet verified", "up");
      setChange(false);
    } catch (e) {
      sfx.error();
      setErr(e instanceof Error ? e.message : "Could not verify the wallet");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wallet-box">
      <p className="small muted">Sign a free message to prove the wallet is yours. No transaction, no approval, nothing can move.</p>
      {wallets.length ? (
        <div className="wallet-btns">
          {wallets.map((w) => (
            <button key={w.id} className="btn btn-primary" disabled={!!busy} onClick={() => go(w)}>
              {w.icon && <img className="wallet-ico" src={w.icon} alt="" />}
              {busy === w.id ? "Check your wallet…" : `Verify with ${w.name}`}
            </button>
          ))}
        </div>
      ) : (
        <div className="wallet-btns">
          <a className="btn btn-primary" href={phantomBrowseLink()}>
            Open in Phantom
          </a>
          <a className="btn" href="https://phantom.app/download" target="_blank" rel="noreferrer">
            Get Phantom
          </a>
        </div>
      )}
      {err && <p className="err small">{err}</p>}
      {change && (
        <button className="btn btn-ghost btn-sm" onClick={() => setChange(false)}>
          Keep {short(me.wallet)}
        </button>
      )}
    </div>
  );
}
