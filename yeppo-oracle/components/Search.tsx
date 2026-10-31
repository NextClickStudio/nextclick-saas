"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mintFrom } from "@/lib/format";

/** paste a coin address or link, land on its read */
export default function Search({ autoFocus, label = "Read it" }: { autoFocus?: boolean; label?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const go = (s: string) => {
    const m = mintFrom(s);
    if (!m) return setErr("Paste a coin address or a link to the coin.");
    setErr(null);
    setQ("");
    router.push(`/c/${m}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <div className="field">
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setErr(null);
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (mintFrom(t)) {
              e.preventDefault();
              go(t);
            }
          }}
          placeholder="Paste a coin address or link"
          spellCheck={false}
          aria-label="Coin address"
        />
        <button className="btn btn-go btn-sm" type="submit">
          {label}
        </button>
      </div>
      {err && <span className="field-err">{err}</span>}
    </form>
  );
}
