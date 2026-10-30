"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mintFrom } from "@/lib/format";

export default function Search({ small, autoFocus }: { small?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const go = () => {
    const m = mintFrom(q);
    if (!m) {
      setErr("Paste a coin address (CA) or a link to the coin");
      return;
    }
    setErr(null);
    setQ("");
    router.push(`/c/${m}`);
  };
  return (
    <form
      className={`search ${small ? "sm" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setErr(null);
        }}
        onPaste={(e) => {
          const m = mintFrom(e.clipboardData.getData("text"));
          if (m) {
            e.preventDefault();
            router.push(`/c/${m}`);
          }
        }}
        placeholder={small ? "Paste a coin address…" : "Paste any pump.fun coin address or link…"}
        spellCheck={false}
        aria-label="Coin address"
      />
      <button className={`btn btn-glow ${small ? "btn-sm" : ""}`} type="submit">
        {small ? "Scan" : "See its future →"}
      </button>
      {err && <span className="search-err">{err}</span>}
    </form>
  );
}
