// Persone chiave di un'azienda (dal sito e dal web) trasformate in canali di contatto.
import "server-only";
import type { Evaluation, WebPerson } from "@/lib/ai";
import { safeFetch, type ContactChannel } from "@/lib/crawler";

type Person = { name: string; role: string; instagram_url: string; linkedin_url: string; whatsapp_url: string };

const linkedinSearch = (name: string, company: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${company}`)}`;

/**
 * Canali delle persone chiave prima di quelli aziendali: chi apre WhatsApp o Instagram
 * scrive così alla persona che decide. Chi non ha profili resta come "persona" con una ricerca LinkedIn pronta.
 */
export function withPeople(companyName: string, people: Person[], channels: ContactChannel[], fromWeb = new Set<string>()): ContactChannel[] {
  const personal: ContactChannel[] = [];
  for (const p of people) {
    const web = fromWeb.has(p.name.toLowerCase()) ? " · dal web" : "";
    const who = { person: p.name, role: p.role, ...(web ? { source: "web" as const } : {}) };
    if (p.whatsapp_url) personal.push({ type: "whatsapp", label: `WhatsApp di ${p.name} (${p.role})`, url: p.whatsapp_url, ...who });
    if (p.instagram_url) personal.push({ type: "instagram", label: `Instagram di ${p.name} (${p.role})${web}`, url: p.instagram_url, ...who });
    if (p.linkedin_url) personal.push({ type: "linkedin", label: `LinkedIn di ${p.name} (${p.role})${web}`, url: p.linkedin_url, ...who });
    if (!p.whatsapp_url && !p.instagram_url && !p.linkedin_url) {
      personal.push({ type: "persona", label: `${p.name} (${p.role})${web}`, url: linkedinSearch(p.name, companyName), ...who });
    }
  }
  // stesso URL già presente come canale aziendale (es. WhatsApp unico): resta solo la versione con la persona
  const urls = new Set(personal.map((c) => c.url));
  return [...personal, ...channels.filter((c) => !c.url || !urls.has(c.url))];
}

/** Mette per primo il canale scelto dal piano (stesso tipo e stessa persona): i link "apri canale" usano il primo del tipo. */
export function planFirst(channels: ContactChannel[], plan: Evaluation["contact_plan"]): ContactChannel[] {
  const i = channels.findIndex((c) => c.type === plan.channel_type && (c.person ?? "") === (plan.person_name ?? ""));
  return i > 0 ? [channels[i], ...channels.slice(0, i), ...channels.slice(i + 1)] : channels;
}

/**
 * Controlla che un profilo Instagram trovato sul web appartenga davvero alla persona:
 * il nome deve comparire nel titolo/descrizione della pagina. Se Instagram non risponde, non si può dire (null).
 */
export async function instagramMatches(url: string, name: string): Promise<boolean | null> {
  try {
    const res = await safeFetch(url, 400 * 1024, 6_000);
    if (res.status === 404) return false;
    if (res.status >= 400) return null;
    const head = res.body.slice(0, 60_000).toLowerCase();
    const title = head.match(/<title[^>]*>([^<]*)/)?.[1] ?? "";
    const metas = [...head.matchAll(/<meta[^>]+(?:og:title|og:description|name="description")[^>]*>/g)].map((m) => m[0]);
    const meta = title + " " + metas.join(" ");
    if (!meta.trim()) return null;
    const surname = name.toLowerCase().split(/\s+/).pop() ?? "";
    return surname.length > 1 && meta.includes(surname);
  } catch {
    return null;
  }
}

/** Le persone trovate sul web, con Instagram verificato, pronte da passare all'analisi come "profili" e "frasi". */
export async function webPeopleAsHints(people: WebPerson[]): Promise<{
  hints: string[];
  profiles: { network: "instagram" | "linkedin"; url: string; context: string }[];
  names: Set<string>;
}> {
  const checked = await Promise.all(
    people.map(async (p) => {
      if (!p.instagram_url) return p;
      return (await instagramMatches(p.instagram_url, p.name)) === false ? { ...p, instagram_url: "" } : p;
    }),
  );
  const hints = checked.map((p) => `${p.name}, ${p.role} (trovato sul web${p.source ? `: ${p.source}` : ""})`);
  const profiles = checked.flatMap((p) => [
    ...(p.linkedin_url ? [{ network: "linkedin" as const, url: p.linkedin_url.replace(/\/$/, ""), context: `${p.name}, ${p.role}` }] : []),
    ...(p.instagram_url ? [{ network: "instagram" as const, url: p.instagram_url.replace(/\/$/, ""), context: `${p.name}, ${p.role}` }] : []),
  ]);
  return { hints, profiles, names: new Set(checked.map((p) => p.name.toLowerCase())) };
}

/** Aggiunge ai canali già salvati le persone trovate sul web (senza rifare l'analisi). */
export function mergeWebPeople(companyName: string, channels: ContactChannel[], people: WebPerson[]): ContactChannel[] {
  const known = new Set(channels.filter((c) => c.person).map((c) => c.person!.toLowerCase()));
  const fresh = people.filter((p) => !known.has(p.name.toLowerCase()));
  // persone già note dal sito: si aggiungono solo i profili che mancavano
  const extra: ContactChannel[] = [];
  for (const p of people.filter((x) => known.has(x.name.toLowerCase()))) {
    const mine = channels.filter((c) => c.person?.toLowerCase() === p.name.toLowerCase());
    const role = mine[0]?.role ?? p.role;
    const person = mine[0]?.person ?? p.name;
    if (p.instagram_url && !mine.some((c) => c.type === "instagram"))
      extra.push({ type: "instagram", label: `Instagram di ${person} (${role}) · dal web`, url: p.instagram_url, person, role, source: "web" });
    if (p.linkedin_url && !mine.some((c) => c.type === "linkedin"))
      extra.push({ type: "linkedin", label: `LinkedIn di ${person} (${role}) · dal web`, url: p.linkedin_url, person, role, source: "web" });
  }
  const added = withPeople(
    companyName,
    fresh.map((p) => ({ ...p, whatsapp_url: "" })),
    [],
    new Set(fresh.map((p) => p.name.toLowerCase())),
  );
  // ordine: persone del sito, poi nuove dal web, poi canali aziendali
  const sitePeople = channels.filter((c) => c.person);
  const company = channels.filter((c) => !c.person);
  return [...sitePeople, ...extra, ...added, ...company];
}
