// Canali di invio e link "con un clic" (usabili anche nel browser: niente segreti qui).
// Instagram e WhatsApp non permettono l'invio automatico di messaggi a chi non ti ha mai scritto
// (regole Meta): Yeppo prepara il testo e apre la chat giusta, l'invio lo conferma l'utente.
import type { ContactChannel, ContactPlan } from "@/lib/types";

export type SendChannel = "instagram" | "whatsapp" | "facebook" | "linkedin" | "sito" | "email";

export const SEND_CHANNEL_LABELS: Record<SendChannel, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Messenger",
  linkedin: "LinkedIn",
  sito: "Chat / modulo del sito",
  email: "Email",
};

/** Canali su cui si può scrivere a questa azienda, con il consigliato per primo. Email sempre come riserva. */
export function sendChannelsFor(channels: ContactChannel[] | null, recommended?: string | null): SendChannel[] {
  const list = channels ?? [];
  const has = (t: string) => list.some((c) => c.type === t);
  const out: SendChannel[] = [];
  const map: Record<string, SendChannel> = {
    instagram: "instagram",
    whatsapp: "whatsapp",
    facebook: "facebook",
    linkedin: "linkedin",
    chat_live: "sito",
    form_contatti: "sito",
    pagina_contatti: "sito",
    pagina_partner: "sito",
  };
  if (recommended && map[recommended] && has(recommended)) out.push(map[recommended]);
  if (recommended === "linkedin" && !out.includes("linkedin")) out.push("linkedin");
  for (const c of list) {
    const s = map[c.type];
    if (s && !out.includes(s)) out.push(s);
  }
  if (!out.includes("email")) out.push("email");
  return out.slice(0, 4);
}

/** Link per aprire il canale (con il testo già pronto dove il canale lo permette). */
export function sendLink(
  channel: SendChannel,
  channels: ContactChannel[] | null,
  text: string,
  subject = "",
  website = "",
): { href: string; prefilled: boolean } {
  const list = channels ?? [];
  const find = (...types: string[]) => list.find((c) => types.includes(c.type) && c.url)?.url;
  switch (channel) {
    case "whatsapp": {
      const url = find("whatsapp") ?? "";
      const phone = url.match(/wa\.me\/(\d+)/)?.[1] ?? new URL(url || "https://x").searchParams.get("phone");
      return phone
        ? { href: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, prefilled: true }
        : { href: url || "https://web.whatsapp.com", prefilled: false };
    }
    case "instagram": {
      const handle = (find("instagram") ?? "").split("instagram.com/")[1]?.replace(/\/.*$/, "");
      return { href: handle ? `https://ig.me/m/${handle}` : "https://instagram.com", prefilled: false };
    }
    case "facebook": {
      const page = (find("facebook") ?? "").split("facebook.com/")[1]?.replace(/\/.*$/, "");
      return { href: page ? `https://m.me/${page}` : "https://facebook.com", prefilled: false };
    }
    case "linkedin":
      return { href: find("linkedin") ?? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(website)}`, prefilled: false };
    case "sito":
      return { href: find("pagina_partner", "form_contatti", "pagina_contatti", "chat_live") ?? website, prefilled: false };
    case "email":
      return { href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, prefilled: true };
  }
}

/** Giorni di attesa prima del follow-up successivo (dopo il passo indicato). */
export const FOLLOWUP_DAYS = [3, 4];
export const MAX_STEP = 2;

/** Link per rispondere a una richiesta di call sul canale scelto dall'azienda. */
export function replyLink(channel: string, contact: string, text: string, subject = "Call di 15 minuti"): { href: string; prefilled: boolean } {
  const digits = contact.replace(/[^\d+]/g, "").replace(/^00/, "+");
  // numeri italiani senza prefisso: aggiunge +39
  const intl = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("3") || digits.startsWith("0") ? `39${digits}` : digits;
  switch (channel) {
    case "whatsapp":
      return { href: `https://wa.me/${intl}?text=${encodeURIComponent(text)}`, prefilled: true };
    case "telefono":
      return { href: `tel:+${intl}`, prefilled: false };
    case "email":
      return { href: `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, prefilled: true };
    case "instagram": {
      const handle = contact.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
      return { href: `https://ig.me/m/${handle}`, prefilled: false };
    }
    default:
      return { href: "#", prefilled: false };
  }
}

/** Un'azienda pronta per l'outreach (analizzata, con report). */
export type OutreachItem = {
  id: string;
  name: string;
  website: string;
  sessionId: string;
  sessionName: string;
  score: number;
  position: number | null;
  total: number;
  status: string;
  channels: ContactChannel[] | null;
  plan: ContactPlan | null;
  reportUrl: string;
  views: number;
  lastViewedAt: string | null;
  step: number;
  nextFollowupAt: string | null;
  lastContactedAt: string | null;
  drafts: Record<string, { generated_at: string; messages: { channel: string; subject?: string; body: string }[] }> | null;
  /** follow-up scaduto (calcolato dal server) */
  due: boolean;
};

const OPEN = ["contattata", "report_aperto"];
export const DONE_STATUSES = ["ha_risposto", "chiamata", "cliente", "non_interessata"];

/** Divide le aziende in: oggi, caldi (hanno aperto il report), follow-up scaduti, da contattare, in attesa, concluse. */
export function groupOutreach(items: OutreachItem[]) {
  const hot = items.filter((i) => i.views > 0 && OPEN.includes(i.status));
  const due = items.filter((i) => OPEN.includes(i.status) && i.due && i.step <= MAX_STEP);
  const fresh = items.filter((i) => i.status === "da_contattare").sort((a, b) => a.score - b.score);
  const waiting = items.filter((i) => OPEN.includes(i.status) && !i.due);
  // "Oggi": prima i caldi, poi i follow-up scaduti, poi fino a 10 nuovi contatti
  const seen = new Set<string>();
  const today = [...hot, ...due, ...fresh.slice(0, 10)].filter((i) => !seen.has(i.id) && seen.add(i.id));
  return { today, hot, due, fresh, waiting, done: items.filter((i) => DONE_STATUSES.includes(i.status)) };
}
