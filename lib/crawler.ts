// Visita il sito di un'azienda ed estrae il testo utile per l'analisi.
// Regole: rispetta robots.txt, max 3 pagine, 1 secondo di pausa tra le richieste,
// niente IP privati/localhost, niente dati personali salvati.
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

function userAgent(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://zeppo";
  return `ZeppoBot/1.0 (+${site})`;
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
async function safeFetch(startUrl: string, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS): Promise<FetchResult> {
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
 * vale per tutti (User-agent: *) o per ZeppoBot.
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

  // se esiste un gruppo specifico per ZeppoBot vale quello, altrimenti "*"
  const specific = groups.filter((g) => g.agents.some((a) => a.includes("zeppobot")));
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

/**
 * Analizza il sito: robots.txt, homepage e fino a 2 pagine interne.
 * Lancia UserError con un messaggio chiaro se qualcosa va storto.
 */
export async function crawlSite(websiteUrl: string): Promise<ExtractedPage[]> {
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

  for (const pageUrl of pickInternalPages(homeData.links, home.finalUrl.toString())) {
    if (Date.now() - started > CRAWL_BUDGET_MS) break;
    await sleep(PAUSE_MS);
    try {
      const res = await safeFetch(pageUrl);
      if (res.status >= 400) continue;
      const data = extractPage(res.body, res.finalUrl.toString());
      pages.push({ url: res.finalUrl.toString(), title: data.title, content: data.content });
    } catch {
      // una pagina interna che non si carica non blocca l'analisi
    }
  }
  return pages;
}
