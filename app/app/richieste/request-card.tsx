"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, copyText } from "@/components/client-utils";
import { Badge, ErrorBox, btn, input } from "@/components/ui";
import { replyLink } from "@/lib/outreach";
import { formatDate } from "@/lib/types";

export type CallRequestItem = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  channel: string;
  contact: string;
  preferred_time: string | null;
  message: string | null;
  status: "nuova" | "accettata" | "rifiutata";
  created_at: string;
  companyName: string;
  website: string;
  sessionName: string;
  projectId: string;
};

const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", telefono: "Telefono", email: "Email", instagram: "Instagram" };

export default function RequestCard({
  item,
  senderName,
  senderCompany,
  bookingUrl,
}: {
  item: CallRequestItem;
  senderName: string;
  senderCompany: string;
  bookingUrl: string;
}) {
  const router = useRouter();
  const firstName = item.name.split(" ")[0];
  const [text, setText] = useState(
    `Ciao ${firstName}, sono ${senderName || "io"}${senderCompany ? ` di ${senderCompany}` : ""}. Grazie per aver letto l'analisi di ${item.companyName}! ` +
      (item.preferred_time
        ? `Confermo volentieri la call di 15 minuti (${item.preferred_time}): ti va bene se fissiamo un orario preciso?`
        : "Quando ti è comodo fare una call di 15 minuti questa settimana?") +
      (bookingUrl ? ` Se preferisci, scegli tu l'orario qui: ${bookingUrl}` : ""),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function setStatus(status: "accettata" | "rifiutata") {
    setLoading(true);
    setError("");
    try {
      await api(`/api/app/calls/${item.id}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function reply() {
    const link = replyLink(item.channel, item.contact, text);
    if (!link.prefilled) {
      setCopied(await copyText(text));
      setTimeout(() => setCopied(false), 4000);
    }
    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`rounded-2xl border p-5 ${item.status === "nuova" ? "glow-border border-transparent bg-panel" : "border-white/[0.07] bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-semibold text-white">{item.companyName}</p>
            {item.status === "nuova" && <Badge tone="accent">Nuova richiesta</Badge>}
            {item.status === "accettata" && <Badge tone="green">Accettata</Badge>}
            {item.status === "rifiutata" && <Badge>Rifiutata</Badge>}
          </div>
          <p className="text-sm text-zinc-400">
            {item.name}
            {item.role && ` · ${item.role}`} · {CHANNEL_LABEL[item.channel]}: <span className="text-zinc-200">{item.contact}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {formatDate(item.created_at, true)} · {item.sessionName}
            {item.preferred_time && ` · preferisce: ${item.preferred_time}`}
          </p>
          {item.message && <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm italic text-zinc-300">“{item.message}”</p>}
        </div>
        {item.status === "nuova" && (
          <div className="flex gap-2">
            <button className={btn.accent} onClick={() => setStatus("accettata")} disabled={loading}>✓ Accetta</button>
            <button className={btn.ghost} onClick={() => setStatus("rifiutata")} disabled={loading}>Rifiuta</button>
          </div>
        )}
      </div>

      {item.status === "accettata" && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <p className="text-sm text-zinc-400">Rispondi per fissare l&apos;orario (puoi modificare il testo):</p>
          <textarea className={`${input} min-h-[110px]`} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn.primary} onClick={reply}>
              {item.channel === "telefono" ? "Chiama" : `Rispondi su ${CHANNEL_LABEL[item.channel]}`} ↗
            </button>
            {copied && <span className="text-xs text-emerald-300">Testo copiato: incollalo nella chat</span>}
            <Link href={`/app/sessioni/${item.projectId}/aziende/${item.company_id}`} className="ml-auto text-xs text-zinc-400 hover:text-white">
              Dettaglio azienda →
            </Link>
          </div>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </div>
  );
}
