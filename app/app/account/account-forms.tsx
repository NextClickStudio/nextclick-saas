"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/client-utils";
import { Card, ErrorBox, btn, input, label } from "@/components/ui";

export default function AccountForms({
  fullName,
  companyName,
  senderRole,
  bookingUrl,
  companyWebsite,
  companyOffer,
}: {
  fullName: string;
  companyName: string;
  senderRole: string;
  bookingUrl: string;
  companyWebsite: string;
  companyOffer: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState({ full_name: fullName, company_name: companyName, sender_role: senderRole, booking_url: bookingUrl, company_website: companyWebsite, company_offer: companyOffer });
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ profile?: string; password?: string; error?: string }>({});
  const [loading, setLoading] = useState("");

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    setMsg({});
    try {
      await fn();
    } catch (err) {
      setMsg({ error: (err as Error).message });
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold text-white">Profilo e firma dei messaggi</h2>
          <p className="mt-1 text-sm text-zinc-500">L&apos;AI usa questi dati per firmare i messaggi di outreach.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="n">Nome e cognome</label>
            <input id="n" className={input} value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="c">Azienda</label>
            <input id="c" className={input} value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="r">Ruolo</label>
            <input id="r" className={input} placeholder="Founder, Account manager…" value={profile.sender_role} onChange={(e) => setProfile({ ...profile, sender_role: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="w">Sito della tua azienda</label>
            <input id="w" className={input} placeholder="https://tuosito.it" value={profile.company_website} onChange={(e) => setProfile({ ...profile, company_website: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="o">Cosa offri, in una frase</label>
            <textarea
              id="o"
              rows={2}
              className={input}
              placeholder="Es. Aiutiamo gli e-commerce di moda ad avere foto e video prodotto professionali in 48 ore, con l'AI."
              value={profile.company_offer}
              onChange={(e) => setProfile({ ...profile, company_offer: e.target.value })}
            />
            <p className="mt-1 text-xs text-zinc-600">Compare nel report sotto &quot;Chi ha preparato questa analisi&quot;.</p>
          </div>
          <div>
            <label className={label} htmlFor="b">Link per prenotare una call <span className="text-zinc-600">(facoltativo)</span></label>
            <input id="b" className={input} placeholder="https://calendly.com/…" value={profile.booking_url} onChange={(e) => setProfile({ ...profile, booking_url: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={btn.primary}
            disabled={loading !== ""}
            onClick={() =>
              run("profile", async () => {
                await api("/api/app/account", { method: "PATCH", body: profile });
                setMsg({ profile: "Salvato ✓" });
                router.refresh();
              })
            }
          >
            Salva
          </button>
          {msg.profile && <span className="text-sm text-emerald-300">{msg.profile}</span>}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-white">Cambia password</h2>
        <div>
          <label className={label} htmlFor="p">Nuova password</label>
          <input id="p" type="password" minLength={8} autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button
            className={btn.secondary}
            disabled={loading !== "" || password.length < 8}
            onClick={() =>
              run("password", async () => {
                await api("/api/auth/update-password", { body: { password } });
                setPassword("");
                setMsg({ password: "Password aggiornata ✓" });
              })
            }
          >
            Aggiorna password
          </button>
          {msg.password && <span className="text-sm text-emerald-300">{msg.password}</span>}
        </div>
      </Card>

      <ErrorBox>{msg.error}</ErrorBox>

      <Card className="border-red-500/25 p-6">
        <h2 className="font-semibold text-red-300">Elimina account</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-400">
          Elimina definitivamente account, sessioni, aziende, analisi e report. Le sessioni non usate andranno perse. Non si può annullare.
        </p>
        <button
          className={btn.danger}
          disabled={loading !== ""}
          onClick={() => {
            if (prompt("Per confermare scrivi: ELIMINA") !== "ELIMINA") return;
            void run("delete", async () => {
              await api("/api/app/account", { method: "DELETE" });
              // ricarica completa voluta: così la pagina legge i nuovi cookie di login
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
            });
          }}
        >
          Elimina il mio account
        </button>
      </Card>
    </div>
  );
}
