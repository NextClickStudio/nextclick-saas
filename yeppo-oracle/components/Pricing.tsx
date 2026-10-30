"use client";

import Link from "next/link";
import qrcode from "qrcode-generator";
import { useEffect, useMemo, useState } from "react";
import { license, pay, savedKey, type License, type Order, type PayPlan } from "@/lib/pay";
import { writeLocal } from "@/lib/supabase";
import { Footer, Reveal } from "./Home";
import TopBar from "./TopBar";

const FEATURES = [
  "The extension on pump.fun, GMGN, Axiom, Photon, BullX, DexScreener",
  "Verdict and red flags on every new coin",
  "Exit Plan: take profit, stop, time limit, max size",
  "Safety Net: bag alarms, slow down, stop for today",
  "Creator records and fast-seller check",
];

function Qr({ text }: { text: string }) {
  const cells = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const out: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: out.join("") };
  }, [text]);
  return (
    <svg className="qr" viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      <path d={cells.d} fill="#07080b" />
    </svg>
  );
}

function Copy({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="copy"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        })
      }
    >
      {ok ? "copied ✓" : (label ?? "copy")}
    </button>
  );
}

export default function Pricing() {
  const [plans, setPlans] = useState<PayPlan[] | null>(null);
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ key: string; until: number } | null>(null);
  const [mine, setMine] = useState<License | null>(null);
  const [keyIn, setKeyIn] = useState("");

  useEffect(() => {
    pay<{ open: boolean; plans: PayPlan[] }>({ action: "plans" })
      .then((r) => {
        setPlans(r.plans);
        setOpen(r.open);
      })
      .catch(() => setPlans([]));
    const k = savedKey();
    if (k) void license(k).then(setMine);
  }, []);

  // look for the payment every 6 seconds while the order is open
  useEffect(() => {
    if (!order || paid) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const r = await pay<{ paid: boolean; key?: string; until?: number; expired?: boolean }>({ action: "check", id: order.id });
        if (!alive) return;
        if (r.paid && r.key) {
          writeLocal("yo:key", r.key);
          setPaid({ key: r.key, until: r.until ?? 0 });
        } else if (r.expired) setErr("This order expired. Start a new one.");
      } catch {
        /* the next check will do */
      }
    }, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [order, paid]);

  const buy = async (p: PayPlan) => {
    setErr(null);
    try {
      setOrder(await pay<Order>({ action: "order", plan: p.id }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <>
      <TopBar />
      <main className="page wrap">
        <Reveal className="page-head">
          <span className="h-eyebrow">Pricing</span>
          <h1 className="disp">One plan. Paid in SOL.</h1>
          <p>No account, no card, no email. Pay from any Solana wallet and you get a key that unlocks the extension on every device.</p>
        </Reveal>

        {!open && (
          <Reveal className="beta">
            <b>🎁 Free during the beta</b>
            <span>Everything works without paying until launch. Install the extension and use it.</span>
            <Link href="/extension" className="btn btn-glow btn-sm">
              Get the extension
            </Link>
          </Reveal>
        )}

        <div className="plans">
          {(plans ?? []).map((p, i) => (
            <Reveal key={p.id} className={`plan ${i === 1 ? "best" : ""}`} delay={i * 80}>
              {i === 1 && <span className="plan-tag">Best value</span>}
              <h3>{p.name}</h3>
              <div className="plan-price">
                <b className="mono">{p.sol}</b>
                <span>SOL / {p.days} days</span>
              </div>
              <p className="plan-per">{(p.sol / (p.days / 30)).toFixed(2)} SOL a month</p>
              <ul>
                {FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={`btn ${i === 1 ? "btn-glow" : "btn-ghost"}`} disabled={!open} onClick={() => void buy(p)}>
                {open ? `Pay ${p.sol} SOL` : "Opens at launch"}
              </button>
            </Reveal>
          ))}
          {!plans && <div className="plan skel-plan" />}
        </div>

        {err && <p className="pay-err">{err}</p>}

        {order && (
          <div className="checkout">
            {paid ? (
              <div className="checkout-done">
                <h2 className="disp">✅ Paid. Here is your key.</h2>
                <div className="keybox">
                  <b className="mono">{paid.key}</b>
                  <Copy text={paid.key} />
                </div>
                <p>
                  Valid until {new Date(paid.until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Open the
                  extension, paste the key once, done. It is saved in this browser too. Keep it somewhere safe: it is the only proof of your plan.
                </p>
              </div>
            ) : (
              <>
                <div className="checkout-qr">
                  <Qr text={order.url} />
                  <a className="btn btn-glow btn-sm" href={order.url}>
                    Open in my wallet
                  </a>
                </div>
                <div className="checkout-steps">
                  <h2 className="disp">Send exactly {order.sol} SOL</h2>
                  <p>Scan the code with Phantom, Solflare or Backpack, or send it by hand. The last digits identify your payment, so send the exact amount.</p>
                  <div className="field">
                    <span>Amount</span>
                    <b className="mono">{order.sol} SOL</b>
                    <Copy text={order.sol} />
                  </div>
                  <div className="field">
                    <span>To</span>
                    <b className="mono">{order.wallet}</b>
                    <Copy text={order.wallet} />
                  </div>
                  <p className="waiting">
                    <i className="dot" /> Waiting for the payment on the Solana chain. This page updates by itself.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="have-key">
          <h3>Already have a key?</h3>
          {mine?.ok ? (
            <p className="up">
              Your plan is active until {new Date(mine.until ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const k = keyIn.trim().toUpperCase();
                const l = await license(k).catch(() => ({ ok: false }) as License);
                setMine(l);
                if (l.ok) writeLocal("yo:key", k);
                else setErr("That key is not active.");
              }}
            >
              <input value={keyIn} onChange={(e) => setKeyIn(e.target.value)} placeholder="YEP-XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} />
              <button className="btn btn-sm btn-ghost">Check</button>
            </form>
          )}
        </div>

        <p className="pay-fine">
          Payments go straight to yeppo&apos;s Solana wallet and are final. A plan unlocks the tool for the days paid; it does not renew by itself. See the{" "}
          <Link href="/terms">terms</Link> and the <Link href="/risk">risk disclosure</Link>.
        </p>
      </main>
      <Footer />
    </>
  );
}
