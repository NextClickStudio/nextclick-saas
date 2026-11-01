"use client";

import Link from "next/link";
import qrcode from "qrcode-generator";
import { useEffect, useMemo, useState } from "react";
import { license, pay, savedKey, type License, type Order, type PayPlan } from "@/lib/pay";
import { readLocal, writeLocal } from "@/lib/supabase";
import Nav, { Footer } from "./Nav";
import Reveal from "./Reveal";

const PRO = [
  "The call on any coin: Momentum, Wait or Don't buy",
  "Safety checks and the launch bundle",
  "The creator's past coins on your chart",
  "Outlook on 4 timeframes and the money trail",
  "Live: the call updates with every trade",
];

/** hand the key to the extension (its content script on yeppo.it listens), so nothing has to be pasted */
function linkExtension(key: string) {
  window.postMessage({ yeppo: "link", key }, window.location.origin);
}

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
      className="copy-btn"
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
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === window && e.origin === window.location.origin && e.data?.yeppo === "linked") setLinked(true);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  useEffect(() => {
    pay<{ open: boolean; plans: PayPlan[] }>({ action: "plans" })
      .then((r) => {
        setPlans(r.plans);
        setOpen(r.open);
      })
      .catch(() => setPlans([]));
    // an order still waiting for its payment (the page was closed or reloaded): pick it up again
    const o = readLocal<Order | null>("yo:order", null);
    if (o && o.expires > Date.now()) setOrder(o);
    const k = savedKey();
    if (k)
      void license(k).then((l) => {
        setMine(l);
        if (l.ok) linkExtension(k);
      });
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
          writeLocal("yo:order", null);
          linkExtension(r.key);
          setPaid({ key: r.key, until: r.until ?? 0 });
        } else if (r.expired) {
          writeLocal("yo:order", null);
          setErr("This order expired. Start a new one.");
        }
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
      const o = await pay<Order>({ action: "order", plan: p.id });
      // kept in this browser until it is paid, so closing the page never loses the key
      writeLocal("yo:order", o);
      setOrder(o);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <>
      <Nav />
      <main className="page wrap">
        <Reveal className="page-head">
          <span className="label">Pricing</span>
          <h1>one key. paid in SOL.</h1>
          <p>No account, no card, no email. Pay from any Solana wallet, get a key, and the extension turns on.</p>
        </Reveal>

        <div className="plans">
          {(plans ?? []).map((p, i) => (
            <Reveal key={p.id} className={`card plan ${i === 1 ? "glow-edge" : ""}`} delay={i * 80}>
              {i === 1 && (
                <span className="chip tone t-up" style={{ position: "absolute", top: 16, right: 16 }}>
                  Best value
                </span>
              )}
              <h3>{p.name}</h3>
              <div className="plan-price">
                <b className="mono">{p.sol}</b>
                <span>SOL / {p.days} days</span>
              </div>
              <p className="plan-per">{(p.sol / (p.days / 30)).toFixed(2)} SOL a month</p>
              <ul>
                {PRO.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button className={`btn ${i === 1 ? "btn-go" : ""}`} disabled={!open} onClick={() => void buy(p)}>
                {open ? `Pay ${p.sol} SOL` : "Opens soon"}
              </button>
            </Reveal>
          ))}
          {!plans && <div className="skel" style={{ height: 300 }} />}
        </div>

        {err && <p className="down small">{err}</p>}

        {order && (
          <div className="card checkout">
            {paid ? (
              <div>
                <h2>Paid. Here is your key.</h2>
                <div className="kv">
                  <b className="mono">{paid.key}</b>
                  <Copy text={paid.key} />
                </div>
                <p>
                  Valid until {new Date(paid.until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.{" "}
                  {linked
                    ? "Already sent to your extension: Pro is on."
                    : "Open the extension, tap “I have a key” and paste it once."}{" "}
                  It is saved in this browser too. Keep it somewhere safe: it is the only proof of your plan.
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  <Qr text={order.url} />
                  <a className="btn btn-go btn-sm" href={order.url}>
                    Open in my wallet
                  </a>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Send exactly {order.sol} SOL</h2>
                  <p className="mute small">Scan with Phantom, Solflare or Backpack. Send the exact amount: the last digits identify you.</p>
                  <div className="kv">
                    <span>Amount</span>
                    <b className="mono">{order.sol} SOL</b>
                    <Copy text={order.sol} />
                  </div>
                  <div className="kv">
                    <span>To</span>
                    <b className="mono">{order.wallet}</b>
                    <Copy text={order.wallet} />
                  </div>
                  <p className="mute small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <i className="live" /> Waiting for the payment. This page updates by itself.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 36, maxWidth: 520 }}>
          <span className="label">Already have a key?</span>
          {mine?.ok ? (
            <p className="up">
              Your plan is active until {new Date(mine.until ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              {linked ? " Pro is on in your extension too." : ""}
            </p>
          ) : (
            <form
              className="field"
              style={{ marginTop: 10 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const k = keyIn.trim().toUpperCase();
                const l = await license(k).catch(() => ({ ok: false }) as License);
                setMine(l);
                if (l.ok) {
                  writeLocal("yo:key", k);
                  linkExtension(k);
                } else setErr("That key is not active.");
              }}
            >
              <input value={keyIn} onChange={(e) => setKeyIn(e.target.value)} placeholder="YEP-XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} />
              <button className="btn btn-sm">Check</button>
            </form>
          )}
        </div>

        <p className="dim small" style={{ marginTop: 28, maxWidth: 620 }}>
          Payments go straight to yeppo&apos;s Solana wallet and are final. A plan unlocks the tool for the days paid; it does not renew by itself. See the{" "}
          <Link href="/terms">terms</Link> and the <Link href="/risk">risk disclosure</Link>. Paid and no key? Write to{" "}
          <a href="mailto:info@yeppo.it">info@yeppo.it</a> with the transaction signature.
        </p>
      </main>
      <Footer />
    </>
  );
}
