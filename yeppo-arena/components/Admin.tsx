"use client";

import { useEffect, useState } from "react";
import { arena, readLocal, writeLocal } from "@/lib/supabase";
import { sfx, toast } from "@/lib/fx";
import type { Room } from "@/lib/types";
import { Logo } from "./ui";

export default function Admin() {
  const [form, setForm] = useState({
    admin_code: "",
    name: "",
    minutes: "30",
    starts_in: "10",
    max_players: "50",
    prize_sol: "1",
    prize_note: "",
    start_balance: "10",
    private: false,
  });
  const [created, setCreated] = useState<Room | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, admin_code: readLocal("yeppo:admin", "") }));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { room } = await arena<{ room: Room }>("create_room", {
        ...form,
        minutes: +form.minutes,
        starts_in: +form.starts_in,
        max_players: +form.max_players,
        prize_sol: +form.prize_sol,
        start_balance: +form.start_balance,
      });
      writeLocal("yeppo:admin", form.admin_code);
      setCreated(room);
      sfx.win();
      toast(`Stanza #${room.code} creata`, "up");
    } catch (x) {
      sfx.error();
      setErr(x instanceof Error ? x.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  const link = created ? `${typeof window !== "undefined" ? window.location.origin : "https://yeppo.it"}/r/${created.code}` : "";

  return (
    <main className="admin">
      <header className="lobby-nav">
        <Logo />
        <span className="chip">ADMIN</span>
      </header>
      <div className="admin-card">
        <h1>Crea una stanza</h1>
        <p className="muted">Stanze ufficiali con premio: compaiono nella lobby. Le private si raggiungono solo col link.</p>
        <form onSubmit={submit} className="admin-form">
          <label>
            Codice admin
            <input type="password" value={form.admin_code} onChange={set("admin_code")} required />
          </label>
          <label className="wide">
            Nome stanza
            <input value={form.name} onChange={set("name")} placeholder="Yeppo Friday Cup" required maxLength={40} />
          </label>
          <label>
            Durata (minuti)
            <input inputMode="numeric" value={form.minutes} onChange={set("minutes")} />
          </label>
          <label>
            Inizia tra (minuti)
            <input inputMode="numeric" value={form.starts_in} onChange={set("starts_in")} />
          </label>
          <label>
            Max giocatori
            <input inputMode="numeric" value={form.max_players} onChange={set("max_players")} />
          </label>
          <label>
            Saldo iniziale (SOL finti)
            <input inputMode="decimal" value={form.start_balance} onChange={set("start_balance")} />
          </label>
          <label>
            Premio (SOL)
            <input inputMode="decimal" value={form.prize_sol} onChange={set("prize_sol")} />
          </label>
          <label>
            Nota premio
            <input value={form.prize_note} onChange={set("prize_note")} placeholder="es. offerto da …" maxLength={40} />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.private} onChange={set("private")} /> Stanza privata (solo link)
          </label>
          <button className="btn-buy btn-xl wide" disabled={loading}>
            {loading ? "Creo…" : "Crea stanza"}
          </button>
        </form>
        {err && <div className="form-err">{err}</div>}
        {created && (
          <div className="admin-done">
            <b>
              #{created.code} · {created.name}
            </b>
            <div className="admin-link">
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copiato", "info"))}>
                Copia
              </button>
              <a className="btn-buy" href={`/r/${created.code}`}>
                Apri
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
