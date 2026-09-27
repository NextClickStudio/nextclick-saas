"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COLORS } from "@/lib/cards/palette";
import { useLearn } from "@/lib/learn/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Wordmark } from "./Wordmark";

const ERRORS: Record<string, string> = {
  name_taken: "That name is taken. Every maison is unique.",
  bad_palette: "Pick three colours.",
  house_exists: "You already have a maison.",
};

/** Create your maison: name, monogram, three colours, a manifesto. */
export function OnboardingForm({ firstName }: { firstName: string }) {
  const router = useRouter();
  const { refresh } = useLearn();
  const [name, setName] = useState(firstName ? `Maison ${firstName}` : "");
  const [mono, setMono] = useState("");
  const [palette, setPalette] = useState<string[]>(["#f2eee6", "#651828", "#191817"]);
  const [slot, setSlot] = useState(1);
  const [manifesto, setManifesto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const autoMono =
    name
      .replace(/^maison\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "M";
  const monogram = (mono || autoMono).toUpperCase();

  const pick = (hex: string) => {
    setPalette((p) => p.map((c, i) => (i === slot ? hex : c)));
    setSlot((s) => (s + 1) % 3);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().rpc("maison_create_house", {
      p_name: name.trim(),
      p_monogram: monogram,
      p_palette: palette,
      p_manifesto: manifesto.trim(),
    });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      setError(key ? ERRORS[key] : error.message);
      setBusy(false);
      return;
    }
    await refresh();
    router.replace("/learn");
  };

  const valid = name.trim().length >= 2 && name.trim().length <= 32;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-16">
      <Wordmark />
      <p className="eyebrow mt-10">Your profile</p>
      <h1 className="headline mt-3 text-5xl">Found your maison.</h1>
      <p className="mt-3 text-lg text-muted">Your name in the leagues and duels. Choose it like a creative director.</p>

      {/* Preview */}
      <div className="mt-8 flex items-center gap-4 rounded-3xl bg-surface p-5">
        <span
          className="grid h-20 w-20 shrink-0 place-items-center rounded-[22px] text-3xl font-black tracking-tight"
          style={{ background: palette[0], color: palette[2], boxShadow: `inset 0 0 0 3px ${palette[1]}` }}
        >
          {monogram}
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-extrabold tracking-tight">{name || "Your maison"}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{manifesto || "Your manifesto goes here."}</p>
        </div>
      </div>

      <label className="mt-8 block">
        <span className="eyebrow">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Maison Nera"
          className="mt-2 w-full rounded-2xl bg-surface px-5 py-4 text-lg font-bold outline-none placeholder:text-muted focus:ring-2 focus:ring-ivory"
        />
      </label>

      <label className="mt-6 block">
        <span className="eyebrow">Monogram · up to 3 letters</span>
        <input
          value={mono}
          onChange={(e) => setMono(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 3))}
          placeholder={autoMono}
          className="mt-2 w-full rounded-2xl bg-surface px-5 py-4 text-lg font-bold tracking-[0.3em] uppercase outline-none placeholder:text-muted focus:ring-2 focus:ring-ivory"
        />
      </label>

      <div className="mt-6">
        <span className="eyebrow">Palette · tap a slot, then a colour</span>
        <div className="mt-3 flex gap-3">
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => setSlot(i)}
              aria-label={`Colour ${i + 1}`}
              className={`h-14 flex-1 rounded-2xl ring-offset-2 ring-offset-bg transition ${slot === i ? "ring-2 ring-ivory" : "ring-1 ring-line"}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-9 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.id}
              title={c.name}
              aria-label={c.name}
              onClick={() => pick(c.hex)}
              className="aspect-square rounded-full ring-1 ring-white/10 transition-transform active:scale-90"
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </div>

      <label className="mt-6 block">
        <span className="eyebrow">Manifesto · {140 - manifesto.length} left</span>
        <textarea
          value={manifesto}
          onChange={(e) => setManifesto(e.target.value.slice(0, 140))}
          rows={3}
          placeholder="Tailoring as armour. Colour as a weapon."
          className="mt-2 w-full resize-none rounded-2xl bg-surface px-5 py-4 text-lg outline-none placeholder:text-muted focus:ring-2 focus:ring-ivory"
        />
      </label>

      {error && <p className="mt-4 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-bold text-accent">{error}</p>}

      <button
        onClick={submit}
        disabled={!valid || busy}
        className="mt-8 w-full rounded-2xl bg-ivory py-4 text-lg font-bold text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Opening the doors…" : "Start my first lesson"}
      </button>
    </main>
  );
}
