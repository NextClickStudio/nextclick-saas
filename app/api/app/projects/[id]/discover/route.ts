// Ricerca automatica delle aziende: l'AI cerca sul web, poi ogni sito viene verificato prima di salvarlo.
import { discoverCompanies } from "@/lib/ai";
import { handle, ownedProjectId, uuid } from "@/lib/api";
import { siteResponds } from "@/lib/crawler";
import { getUserProject } from "@/lib/data";
import { db, UserError } from "@/lib/db";
import { requireUser } from "@/lib/supabase-auth";
import { isBlockedHostname, normalizeUrl } from "@/lib/url";

export const maxDuration = 120;

// Domini che non sono il sito di un'azienda (marketplace, social, directory).
const NOT_COMPANY = /(amazon|ebay|etsy|zalando|facebook|instagram|linkedin|tiktok|youtube|wikipedia|google|paginegialle|trustpilot|tripadvisor|shopify\.com$|wix\.com$)/i;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const id = await ownedProjectId(uuid.parse((await params).id), user.id);
    const project = (await getUserProject(id, user.id))!;
    if (!project.credit_used_at) throw new UserError("Avvia prima la sessione.");

    // aziende di questa sessione (per il limite) e di TUTTE le sessioni dell'utente (per non riproporle mai)
    const { data: existing, error } = await db()
      .from("companies")
      .select("website_url, project_id, projects!inner(user_id)")
      .eq("projects.user_id", user.id);
    if (error) throw error;
    const all = (existing ?? []) as { website_url: string; project_id: string }[];
    const known = new Set(all.filter((c) => c.project_id === id).map((c) => c.website_url));
    const everSeen = new Set(all.map((c) => c.website_url));
    const missing = project.company_limit - known.size;
    if (missing <= 0) throw new UserError(`Hai già raggiunto il massimo di ${project.company_limit} aziende per questa sessione.`);

    const found = await discoverCompanies({
      productDescription: project.product_description,
      targetCustomer: project.target_customer,
      targetSector: project.target_sector,
      targetSize: project.target_size,
      country: project.target_country,
      symptom: project.symptom ?? "",
      count: Math.min(45, Math.ceil(missing * 1.8)),
      exclude: [...everSeen].map((u) => new URL(u).hostname.replace(/^www\./, "")),
    });

    // normalizza, scarta doppioni e domini non aziendali
    const candidates: typeof found = [];
    const seen = new Set(everSeen);
    const seenHosts = new Set([...everSeen].map((u) => new URL(u).hostname.replace(/^www\./, "")));
    for (const c of found) {
      const url = normalizeUrl(c.website);
      if (!url) continue;
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (isBlockedHostname(u.hostname) || NOT_COMPANY.test(host) || seen.has(url) || seenHosts.has(host)) continue;
      seen.add(url);
      seenHosts.add(host);
      candidates.push({ ...c, website: u.origin }); // si analizza sempre dalla homepage
    }

    // verifica in parallelo che i siti esistano davvero
    const checks = await Promise.all(candidates.map((c) => siteResponds(c.website)));
    const verified = candidates.filter((_, i) => checks[i]).slice(0, missing);

    if (verified.length > 0) {
      const { error: insError } = await db()
        .from("companies")
        .insert(
          verified.map((c) => ({
            project_id: id,
            name: c.name.slice(0, 200),
            website_url: c.website,
            source: "ricerca",
            size_estimate: c.size || null,
            discovery_reason: c.reason || null,
          })),
        );
      if (insError) throw insError;
    }
    return {
      found: verified.length,
      discarded: candidates.length - verified.length,
      duplicates: found.length - candidates.length,
      remaining: missing - verified.length,
    };
  });
}
