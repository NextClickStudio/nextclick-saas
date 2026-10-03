// Funzioni "pure" per URL e import delle aziende.
// Non usano rete né database: così si possono testare facilmente (vedi tests/).

/**
 * Normalizza l'URL di un sito:
 * - aggiunge https:// se manca
 * - accetta solo http/https
 * - hostname in minuscolo, niente "#ancora", niente slash finali
 * Restituisce null se l'URL non è valido.
 */
export function normalizeUrl(input: string): string | null {
  let raw = (input || "").trim();
  if (!raw) return null;
  // "//sito.it" o "sito.it" -> https://sito.it
  if (raw.startsWith("//")) raw = "https:" + raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "https://" + raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || !url.hostname.includes(".") && url.hostname !== "localhost") return null;
  if (url.username || url.password) return null;

  url.hash = "";
  let out = url.protocol + "//" + url.host.toLowerCase() + url.pathname + url.search;
  // togli gli slash finali (ma non quello di "https://")
  out = out.replace(/\/+$/, "");
  return out;
}

/** true se l'hostname è un indirizzo IP (v4 o v6) scritto direttamente. */
export function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
}

/** true se l'indirizzo IP è privato, locale o riservato (da NON visitare). */
export function isPrivateIp(ip: string): boolean {
  let a = ip.replace(/^\[|\]$/g, "").toLowerCase();
  // IPv4 "mappato" in IPv6, es. ::ffff:127.0.0.1
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) a = mapped[1];

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) {
    const [p1, p2] = a.split(".").map(Number);
    if (p1 === 10 || p1 === 127 || p1 === 0) return true;
    if (p1 === 169 && p2 === 254) return true; // link-local / metadata cloud
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 100 && p2 >= 64 && p2 <= 127) return true; // CGNAT
    if (p1 >= 224) return true; // multicast e riservati
    return false;
  }
  // IPv6
  if (a === "::" || a === "::1") return true;
  if (a.startsWith("fc") || a.startsWith("fd")) return true; // unique local
  if (a.startsWith("fe8") || a.startsWith("fe9") || a.startsWith("fea") || a.startsWith("feb")) return true; // link-local
  if (a.startsWith("ff")) return true; // multicast
  return false;
}

/** Controllo "a parole" dell'hostname: blocca localhost e nomi interni. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home")) return true;
  if (isIpLiteral(h)) return isPrivateIp(h);
  return false;
}

export type ParsedCompany = { name: string; url: string };
export type ParseResult = {
  companies: ParsedCompany[];
  invalid: string[]; // righe scartate perché non valide
  duplicates: string[]; // righe scartate perché già presenti
};

/**
 * Legge un testo con una azienda per riga: "Nome, https://sito.it".
 * Funziona anche con un CSV con intestazione "nome,url" e separatore ; o tab.
 */
export function parseCompanyList(text: string): ParseResult {
  const companies: ParsedCompany[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // salta l'intestazione del CSV
    if (/^"?nome"?\s*[,;\t]\s*"?url"?$/i.test(line)) continue;

    // separa sull'ULTIMA virgola/punto e virgola/tab: il nome può contenere virgole
    const m = line.match(/^(.*)[,;\t]\s*(\S+)$/);
    if (!m) {
      invalid.push(line);
      continue;
    }
    const name = m[1].trim().replace(/^"|"$/g, "").trim();
    const url = normalizeUrl(m[2].replace(/^"|"$/g, ""));
    if (!name || !url || isBlockedHostname(new URL(url).hostname)) {
      invalid.push(line);
      continue;
    }
    if (seen.has(url)) {
      duplicates.push(line);
      continue;
    }
    seen.add(url);
    companies.push({ name: name.slice(0, 200), url });
  }
  return { companies, invalid, duplicates };
}
