"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readFlag, setFlag } from "./prefs";

const KEY = "scopo:notice-ok";

/** Avviso una tantum: niente cookie nostri, ma i video passano da YouTube. */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShow(!readFlag(KEY)), 1200);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <div className="notice" role="region" aria-label="Cookies and privacy">
      <p>
        <strong>No tracking cookies.</strong> We only keep your preferences on this device. Videos play
        through YouTube, which may set its own cookies. <Link href="/cookies">Cookie policy</Link>
      </p>
      <button
        type="button"
        className="btn btn-volt btn-sm"
        onClick={() => {
          setFlag(KEY);
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}
