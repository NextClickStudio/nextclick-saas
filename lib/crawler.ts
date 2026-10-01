// Visita il sito di un'azienda ed estrae il testo utile per l'analisi.
// Regole: rispetta robots.txt, max 3 pagine analizzate (+ chi siamo/contatti solo per i contatti),
// 1 secondo di pausa tra le richieste, niente IP privati/localhost.
// Delle persone si tengono solo nome, ruolo e profili che l'azienda stessa pubblica sul proprio sito.
import "server-only";
import { lookup } from "node:dns/promises";
import * as cheerio from "cheerio";
import { UserError } from "@/lib/db";
import { isBlockedHostname, isPrivateIp } from "@/lib/url";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CHARS_PER_PAGE = 12_000;
const MAX_REDIRECTS = 5;
const PAUSE_MS = 1_000;
// oltre questo tempo dall'inizio non visitiamo altre pagine interne,
// per restare sotto i 60 secondi di Vercel insieme alla chiamata AI
const CRAWL_BUDGET_MS = 25_000;

export type ExtractedPage = {
  url: string;
  title: string;
  content: string; // testo già pronto da passare all'AI
};

/** Canale di contatto pubblicato dall'azienda sul proprio sito (mai email o telefoni personali). */
export type ContactChannel = {
  type:
    | "pagina_contatti"
    | "form_contatti"
    | "chat_live"
    | "whatsapp"
    | "instagram"
    | "facebook"
    | "linkedin"
    | "tiktok"
    | "youtube"
    | "telegram"
    | "pagina_partner"
    | "lavora_con_noi"
    | "pagina_stampa"
    | "persona";
  label: string;
  url?: string;
  /** persona dell'azienda a cui arriva il canale (es. founder), se nota */
  person?: string;
  role?: string;
  /** "web" se la persona è stata trovata con una ricerca Google e non sul sito */
  source?: "web";
};

/** Profilo personale (Instagram, LinkedIn, WhatsApp) linkato sul sito, con il testo che lo circonda. */
export type ProfileLink = { network: "instagram" | "linkedin" | "whatsapp"; url: string; context: string };

export type CrawlResult = {
  pages: ExtractedPage[];
  channels: ContactChannel[];
  /** profili personali trovati sul sito (candidati: l'AI li associa a una persona) */
  profiles: ProfileLink[];
  /** frammenti di testo che nominano ruoli chiave (founder, marketing, commerciale...) */
  peopleHints: string[];
};

function userAgent(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yeppo.it";
  return `YeppoBot/1.0 (+${site})`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Blocca URL non http/https, localhost e domini che puntano a IP privati. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserError("Indirizzo non valido: sono ammessi solo siti http/https.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new UserError("Indirizzo non consentito (rete locale o privata).");
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  } catch {
    throw new UserError("Il dominio non esiste o non risponde.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UserError("Indirizzo non consentito (rete locale o privata).");
  }
}

type FetchResult = { finalUrl: URL; status: number; contentType: string; body: string };

/**
 * fetch "sicuro": segue i redirect a mano (controllando ogni tappa),
 * si ferma dopo 10 secondi e legge al massimo 2 MB.
 */
export async function safeFetch(startUrl: string, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = new URL(startUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent(),
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          "Accept-Language": "it-IT,it;q=0.9,en;q=0.5",
        },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        await res.body?.cancel();
        continue;
      }
      const body = await readLimited(res, maxBytes);
      return { finalUrl: url, status: res.status, contentType: res.headers.get("content-type") || "", body };
    }
    throw new UserError("Troppi redirect: il sito rimanda continuamente ad altre pagine.");
  } catch (err) {
    if (err instanceof UserError) throw err;
    if (controller.signal.aborted) throw new UserError("Il sito non ha risposto entro 10 secondi.");
    throw new UserError("Il sito non è raggiungibile.");
  } finally {
    clearTimeout(timer);
  }
}

/** Legge il corpo della risposta fermandosi a maxBytes. */
async function readLimited(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, value.byteLength - (total - maxBytes)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * Controllo semplice di robots.txt: blocca solo se "Disallow: /"
 * vale per tutti (User-agent: *) o per YeppoBot.
 */
export function robotsBlocksAll(robotsTxt: string): boolean {
  const groups: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "disallow" || key === "allow")) current.rules.push(`${key}:${value}`);
    }
  }

  // se esiste un gruppo specifico per YeppoBot vale quello, altrimenti "*"
  const specific = groups.filter((g) => g.agents.some((a) => a.includes("yeppobot")));
  const relevant = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  return relevant.some((g) => g.rules.includes("disallow:/") && !g.rules.includes("allow:/"));
}

async function isBlockedByRobots(origin: string): Promise<boolean> {
  try {
    const res = await safeFetch(origin + "/robots.txt", 500 * 1024, 5_000);
    if (res.status !== 200 || res.contentType.includes("html")) return false;
    return robotsBlocksAll(res.body);
  } catch {
    return false; // robots.txt assente o irraggiungibile: si procede
  }
}

// Rimuove email e numeri di telefono dal testo prima di passarlo all'AI.
function stripPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    // numeri italiani (cellulari 3xx e fissi 0x), con o senza +39
    .replace(/(?:\+39[\s.]?)?\b(?:3\d{2}|0\d{1,3})[\s./-]?\d{3,4}[\s./-]?\d{3,4}\b/g, "[numero]")
    .replace(/\+\d{1,3}[\s\d]{8,15}\d/g, "[numero]");
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Estrae da una pagina HTML le informazioni utili all'analisi. */
export function extractPage(html: string, pageUrl: string): { title: string; content: string; links: string[] } {
  const $ = cheerio.load(html);
  const title = clean($("title").first().text()) || pageUrl;
  const description = clean($('meta[name="description"]').attr("content") || "");

  // Presenza di elementi utili, cercata PRIMA di togliere script e iframe.
  const htmlLower = html.toLowerCase();
  const features: string[] = [];
  if ($("form").length > 0) features.push(`form (${$("form").length})`);
  if (/quiz|questionario|product[-_ ]?finder|test della pelle|skin[-_ ]?test|consulente virtuale|trova la tua routine/.test(htmlLower))
    features.push("quiz / configuratore");
  if (/tidio|intercom|zendesk|crisp\.chat|livechat|tawk\.to|hubspot.*chat|gorgias|wa\.me|whatsapp|chatbot|live[-_ ]?chat/.test(htmlLower))
    features.push("chat / assistenza live");
  if (/filter|filtri|filtra per|facet/.test(htmlLower)) features.push("filtri prodotto");
  if (/judge\.me|yotpo|trustpilot|stamped|okendo|reviews\.io|recensioni|feedaty|trustedshops/.test(htmlLower))
    features.push("recensioni");

  // Link interni della pagina (servono per scegliere le pagine successive).
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      links.push(new URL(href, pageUrl).toString());
    } catch {
      /* link non valido: ignorato */
    }
  });

  // Togli ciò che non è contenuto.
  $("script, style, noscript, svg, iframe, template, link, meta").remove();
  $("nav, footer, [role=navigation], [role=contentinfo], .footer, #footer, .cookie, #cookie-banner").remove();

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length < 200) headings.push(`${el.tagName.toUpperCase()}: ${t}`);
  });

  const buttons = new Set<string>();
  $('button, [role=button], a.btn, a.button, input[type=submit]').each((_, el) => {
    const t = clean($(el).text() || $(el).attr("value") || $(el).attr("aria-label") || "");
    if (t && t.length < 80) buttons.add(t);
  });

  const mainLinks = new Set<string>();
  $("main a, body a").each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 2 && t.length < 80) mainLinks.add(t);
  });

  // spazio dopo ogni elemento, altrimenti i testi di blocchi vicini si "incollano"
  $("body *").each((_, el) => {
    $(el).append(" ");
  });
  const bodyText = clean($("main").text() || $("body").text());

  const parts = [
    `TITOLO: ${title}`,
    description && `META DESCRIPTION: ${description}`,
    features.length ? `ELEMENTI PRESENTI: ${features.join(", ")}` : "ELEMENTI PRESENTI: nessuno tra form, quiz, chat, filtri, recensioni",
    headings.length && `TITOLI:\n${headings.slice(0, 40).join("\n")}`,
    buttons.size && `PULSANTI: ${[...buttons].slice(0, 40).join(" | ")}`,
    mainLinks.size && `LINK PRINCIPALI: ${[...mainLinks].slice(0, 60).join(" | ")}`,
    `TESTO VISIBILE:\n${bodyText}`,
  ].filter(Boolean);

  const content = stripPersonalData(parts.join("\n\n")).slice(0, MAX_CHARS_PER_PAGE);
  return { title: title.slice(0, 200), content, links };
}

const CHAT_PROVIDERS: [RegExp, string][] = [
  [/tidio/, "Tidio"],
  [/intercom/, "Intercom"],
  [/zendesk|zdassets/, "Zendesk"],
  [/crisp\.chat/, "Crisp"],
  [/livechatinc|livechat\.com/, "LiveChat"],
  [/tawk\.to/, "Tawk.to"],
  [/gorgias/, "Gorgias"],
  [/hs-scripts|hubspot.*conversations/, "HubSpot"],
  [/shopify-chat|shopify_chat|inbox\.shopify/, "Shopify Inbox"],
  [/smartsupp/, "Smartsupp"],
  [/freshchat|freshworks/, "Freshchat"],
];

/**
 * Trova i canali di contatto "diretti" che l'azienda pubblica sul proprio sito:
 * chat, WhatsApp, profili social aziendali, pagine contatti/partner/B2B.
 * Non raccoglie email né numeri di telefono.
 */
export function extractChannels(html: string, pageUrl: string): ContactChannel[] {
  return extractContacts(html, pageUrl).channels;
}

/** Numero WhatsApp in formato internazionale (solo cifre) oppure null. */
export function whatsappNumber(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (d.startsWith("+")) d = d.slice(1);
  else if (/^3\d{8,9}$/.test(d)) d = "39" + d; // cellulare italiano senza prefisso
  return /^\d{9,15}$/.test(d) ? d : null;
}

/** Spazio dopo ogni elemento, così i testi di blocchi vicini non si "incollano" (es. "Giulia BianchiFondatrice"). */
function spaceOut($: cheerio.CheerioAPI) {
  $("body *").each((_, el) => {
    $(el).append(" ");
  });
}

const normHandle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Testo vicino a un link (il blocco che lo contiene), per capire a chi appartiene. */
function contextOf($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  let node = $(el);
  for (let i = 0; i < 4; i++) {
    const t = clean(node.text());
    if (t.length >= 25 || node.parent().length === 0) break;
    node = node.parent();
  }
  const own = clean(($(el).attr("aria-label") || "") + " " + ($(el).attr("title") || ""));
  return stripPersonalData(clean(own + " " + clean(node.text())).slice(0, 220));
}

/**
 * Trova i canali di contatto che l'azienda pubblica sul proprio sito: chat, WhatsApp,
 * profili social del brand, pagine contatti/partner/B2B. Separa i profili personali
 * (es. Instagram o LinkedIn del founder nella pagina team) dal profilo del brand.
 */
export function extractContacts(html: string, pageUrl: string): { channels: ContactChannel[]; profiles: ProfileLink[] } {
  const $ = cheerio.load(html);
  spaceOut($);
  const lower = html.toLowerCase();
  const base = new URL(pageUrl);
  const baseHost = base.hostname.replace(/^www\./, "");
  const brand = normHandle(baseHost.split(".").slice(0, -1).join("") || baseHost);
  const found = new Map<string, ContactChannel>();
  const add = (c: ContactChannel) => {
    if (!found.has(c.type)) found.set(c.type, c);
  };
  const instagram = new Map<string, { count: number; context: string; inChrome: boolean }>();
  const whatsapp = new Map<string, string>();
  const profiles: ProfileLink[] = [];

  for (const [re, name] of CHAT_PROVIDERS) {
    if (re.test(lower)) {
      add({ type: "chat_live", label: `Chat sul sito (${name})`, url: base.origin });
      break;
    }
  }
  if ($("form").filter((_, f) => /contatt|contact|messag/i.test($(f).text() + ($(f).attr("action") ?? ""))).length > 0) {
    add({ type: "form_contatti", label: "Modulo di contatto", url: pageUrl });
  }

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
    let u: URL;
    try {
      u = new URL(href, pageUrl);
    } catch {
      return;
    }
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.toLowerCase();
    const isSocialProfile = (h: string) => host === h || host.endsWith("." + h);
    const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
    // link a condivisioni, post singoli o pagine generiche dei social: non sono un profilo
    const genericSocial = /^(share|sharer|intent|p|reel|reels|tv|stories|watch|hashtag|explore|groups|events|home|login|accounts)$/.test(firstSegment);

    if (/^(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|web\.whatsapp\.com)$/.test(host)) {
      const num = host === "wa.me" ? whatsappNumber(firstSegment) : whatsappNumber(u.searchParams.get("phone") ?? "");
      if (num && !whatsapp.has(num)) whatsapp.set(num, contextOf($, el));
      else if (!num && host === "chat.whatsapp.com") add({ type: "whatsapp", label: "WhatsApp aziendale", url: u.toString() });
    } else if (isSocialProfile("instagram.com") && firstSegment && !genericSocial) {
      const prev = instagram.get(firstSegment);
      const inChrome = $(el).closest("header, footer, nav, [class*=footer], [class*=social], [id*=footer]").length > 0;
      instagram.set(firstSegment, {
        count: (prev?.count ?? 0) + 1,
        context: prev?.context ?? contextOf($, el),
        inChrome: (prev?.inChrome ?? false) || inChrome,
      });
    } else if ((isSocialProfile("facebook.com") || host === "fb.com") && firstSegment && !genericSocial) add({ type: "facebook", label: "Pagina Facebook", url: u.origin + u.pathname });
    else if (isSocialProfile("linkedin.com") && /^\/(company|school|showcase)\//.test(path)) add({ type: "linkedin", label: "Pagina LinkedIn aziendale", url: u.origin + u.pathname });
    else if (isSocialProfile("linkedin.com") && /^\/in\/[^/]+/.test(path))
      profiles.push({ network: "linkedin", url: "https://www.linkedin.com" + path.replace(/\/$/, ""), context: contextOf($, el) });
    else if (isSocialProfile("tiktok.com") && firstSegment.startsWith("@")) add({ type: "tiktok", label: `TikTok ${firstSegment}`, url: u.origin + u.pathname });
    else if (isSocialProfile("youtube.com") && firstSegment && !genericSocial) add({ type: "youtube", label: "Canale YouTube", url: u.origin + u.pathname });
    else if (host === "t.me") add({ type: "telegram", label: "Telegram", url: u.toString() });
    else if (host === baseHost || host.endsWith("." + baseHost)) {
      const target = path + " " + text;
      if (/partner|rivendit|wholesale|ingrosso|b2b|affiliat|collabora|diventa-?(nostro)?|reseller|distribut|corporate|aziende/.test(target))
        add({ type: "pagina_partner", label: "Pagina partner / B2B / collaborazioni", url: u.toString() });
      else if (/lavora-?con-?noi|careers|jobs|carriere/.test(target)) add({ type: "lavora_con_noi", label: "Lavora con noi", url: u.toString() });
      else if (/press|stampa|media-?kit/.test(target)) add({ type: "pagina_stampa", label: "Area stampa", url: u.toString() });
      else if (/contatt|contact|assistenza|supporto|help|faq-?contatti/.test(target))
        add({ type: "pagina_contatti", label: "Pagina contatti", url: u.toString() });
    }
  });

  // numero WhatsApp scritto nel testo (es. "WhatsApp: 333 123 4567") senza link wa.me
  $("script, style, noscript").remove();
  const m = clean($("body").text()).match(/whats\s?app[^\d+]{0,30}(\+?[\d][\d\s./-]{7,16}\d)/i);
  const textNum = m ? whatsappNumber(m[1]) : null;
  if (textNum && !whatsapp.has(textNum)) whatsapp.set(textNum, "");

  // Instagram del brand: quello col nome simile al dominio, altrimenti quello in header/footer o il più linkato.
  // Gli altri profili Instagram sono candidati personali (es. founder nella pagina "chi siamo").
  const handles = [...instagram.entries()];
  const brandHandle =
    handles.find(([h]) => {
      const n = normHandle(h);
      return n.length >= 3 && (n.includes(brand) || brand.includes(n));
    })?.[0] ??
    handles.filter(([, v]) => v.inChrome).sort((a, b) => b[1].count - a[1].count)[0]?.[0] ??
    handles.sort((a, b) => b[1].count - a[1].count)[0]?.[0];
  for (const [h, v] of handles) {
    if (h === brandHandle) add({ type: "instagram", label: `Instagram del brand @${h}`, url: `https://instagram.com/${h}` });
    else profiles.push({ network: "instagram", url: `https://instagram.com/${h}`, context: v.context });
  }

  // WhatsApp aziendale: il primo numero non legato a un ruolo (es. "Marco, marketing"), altrimenti il primo trovato.
  // I numeri vicini a una persona vanno anche tra i profili: se l'AI li associa a lei, diventano "WhatsApp di ...".
  const numbers = [...whatsapp.entries()];
  const business = numbers.find(([, ctx]) => !ROLE_RE.test(ctx)) ?? numbers[0];
  if (business) add({ type: "whatsapp", label: "WhatsApp aziendale", url: `https://wa.me/${business[0]}` });
  for (const [num, context] of numbers) if (context) profiles.push({ network: "whatsapp", url: `https://wa.me/${num}`, context });
  return { channels: [...found.values()], profiles };
}

// ruoli di chi decide: servono per trovare nel testo founder, marketing, commerciale...
const ROLE_RE =
  /\b(founder|co-?founder|fondat(?:ore|rice|ori)|ceo|titolare|owner|proprietari[oa]|amministrat(?:ore|rice) delegat[oa]|direttor[ei]|direttrice|general manager|managing director|marketing|commerciale|sales|vendite|e-?commerce manager|responsabile|head of|brand manager|socio|soci[ae]|presidente)\b/i;

/** Frasi del sito che parlano di persone con ruoli chiave (es. "Marco Rossi, fondatore"). */
export function extractPeopleHints(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, template, nav, form").remove();
  spaceOut($);
  const out = new Set<string>();
  $("h1, h2, h3, h4, h5, h6, p, li, figcaption, span, strong, b, em, small, div").each((_, el) => {
    if ($(el).children().length > 6) return; // blocchi troppo grandi
    const own = clean($(el).text());
    if (own.length < 8 || own.length > 400 || !ROLE_RE.test(own)) return;
    // includi il blocco che contiene il ruolo, così il nome vicino resta nel contesto
    let block = own;
    const parentText = clean($(el).parent().text());
    if (parentText.length <= 400) block = parentText;
    out.add(stripPersonalData(block));
  });
  // tieni i frammenti più specifici (evita duplicati contenuti l'uno nell'altro)
  const list = [...out].sort((a, b) => a.length - b.length);
  return list.filter((t, i) => !list.slice(i + 1).some((o) => o.includes(t) && o.length < t.length * 1.5)).slice(0, 25);
}

/** Sceglie al massimo 2 pagine interne da analizzare, in ordine di priorità. */
export function pickInternalPages(links: string[], homeUrl: string): string[] {
  const home = new URL(homeUrl);
  const baseHost = home.hostname.replace(/^www\./, "");
  const candidates: string[] = [];
  const seen = new Set<string>([home.origin + home.pathname.replace(/\/$/, "")]);

  for (const link of links) {
    let u: URL;
    try {
      u = new URL(link);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== baseHost) continue;
    if (!/^https?:$/.test(u.protocol)) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|zip|xml|mp4)$/i.test(u.pathname)) continue;
    const key = u.origin + u.pathname.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(key);
  }

  const picked: string[] = [];
  const take = (test: (path: string) => boolean) => {
    const found = candidates.find((c) => !picked.includes(c) && test(new URL(c).pathname.toLowerCase()));
    if (found && picked.length < 2) picked.push(found);
  };
  take((p) => p.includes("/products/"));
  take((p) => p.includes("/collections/"));
  const words = /prodott|product|shop|negozio|catalog|serviz|service|soluzion|solution/;
  take((p) => words.test(p));
  take((p) => words.test(p));
  return picked;
}

/** Pagine "chi siamo / team" e "contatti": servono solo per trovare persone e canali, non per il punteggio. */
export function pickContactPages(links: string[], homeUrl: string, exclude: string[]): string[] {
  const home = new URL(homeUrl);
  const baseHost = home.hostname.replace(/^www\./, "");
  const urls: string[] = [];
  for (const link of links) {
    try {
      const u = new URL(link);
      if (u.hostname.replace(/^www\./, "") !== baseHost || !/^https?:$/.test(u.protocol)) continue;
      const key = u.origin + u.pathname.replace(/\/$/, "");
      if (key !== home.origin + home.pathname.replace(/\/$/, "") && !exclude.includes(key) && !urls.includes(key)) urls.push(key);
    } catch {
      /* ignorato */
    }
  }
  const about = urls.find((u) => /chi-?siamo|about|team|la-?nostra-?storia|our-?story|storia|founder|fondator|azienda|company|noi\b/i.test(new URL(u).pathname));
  const contact = urls.find((u) => u !== about && /contatt|contact/i.test(new URL(u).pathname));
  return [about, contact].filter((u): u is string => Boolean(u));
}

/**
 * Analizza il sito: robots.txt, homepage e fino a 2 pagine interne.
 * Lancia UserError con un messaggio chiaro se qualcosa va storto.
 */
export async function crawlSite(websiteUrl: string): Promise<CrawlResult> {
  const started = Date.now();
  let start: URL;
  try {
    start = new URL(websiteUrl);
  } catch {
    throw new UserError("L'indirizzo del sito non è valido.");
  }
  await assertPublicUrl(start);

  if (await isBlockedByRobots(start.origin)) {
    throw new UserError("Il sito non consente l'analisi automatica");
  }

  const home = await safeFetch(start.toString());
  if (home.status >= 400) {
    throw new UserError(`La homepage non si carica (errore ${home.status}).`);
  }
  if (!/html|xml|text\/plain/i.test(home.contentType) && home.contentType !== "") {
    throw new UserError("La homepage non è una pagina web leggibile.");
  }
  const homeData = extractPage(home.body, home.finalUrl.toString());
  if (homeData.content.length < 200) {
    throw new UserError("La homepage non contiene testo leggibile (forse il sito è costruito solo in JavaScript).");
  }
  const pages: ExtractedPage[] = [{ url: home.finalUrl.toString(), title: homeData.title, content: homeData.content }];
  const homeContacts = extractContacts(home.body, home.finalUrl.toString());
  const channels = homeContacts.channels;
  const profiles = homeContacts.profiles;
  const hints = new Set(extractPeopleHints(home.body));
  const merge = (html: string, url: string) => {
    const found = extractContacts(html, url);
    // canali trovati anche nelle pagine interne (es. chat caricata solo nelle schede prodotto)
    for (const c of found.channels) {
      const existing = channels.find((x) => x.type === c.type);
      if (!existing) channels.push(c);
      // un secondo Instagram "del brand" su un'altra pagina (es. team senza footer) è un candidato personale
      else if (c.type === "instagram" && c.url && c.url !== existing.url) profiles.push({ network: "instagram", url: c.url, context: "" });
    }
    for (const p of found.profiles) if (!profiles.some((x) => x.url === p.url)) profiles.push(p);
    for (const h of extractPeopleHints(html)) hints.add(h);
  };

  const analysisPages = pickInternalPages(homeData.links, home.finalUrl.toString());
  const contactPages = pickContactPages(homeData.links, home.finalUrl.toString(), analysisPages);
  for (const pageUrl of [...analysisPages, ...contactPages]) {
    if (Date.now() - started > CRAWL_BUDGET_MS) break;
    await sleep(PAUSE_MS);
    try {
      const res = await safeFetch(pageUrl);
      if (res.status >= 400) continue;
      if (analysisPages.includes(pageUrl)) {
        const data = extractPage(res.body, res.finalUrl.toString());
        pages.push({ url: res.finalUrl.toString(), title: data.title, content: data.content });
      }
      merge(res.body, res.finalUrl.toString());
    } catch {
      // una pagina interna che non si carica non blocca l'analisi
    }
  }
  // un profilo Instagram "personale" uguale a quello del brand trovato altrove non è personale
  const brandIg = channels.find((c) => c.type === "instagram")?.url;
  return {
    pages,
    channels,
    profiles: profiles.filter((p) => p.url !== brandIg).slice(0, 15),
    peopleHints: [...hints].slice(0, 25),
  };
}

/** Verifica veloce che un sito esista e risponda (usata per i risultati della ricerca automatica). */
export async function siteResponds(url: string): Promise<boolean> {
  try {
    const res = await safeFetch(url, 300 * 1024, 8_000);
    return res.status < 400 && /html/i.test(res.contentType);
  } catch {
    return false;
  }
}
