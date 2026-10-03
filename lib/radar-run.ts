// Esegue il Radar di un utente: legge Instagram, filtra con l'AI, salva le novità e manda la notifica.
import "server-only";
import { classifyBrandProfiles, discoverInstagramBrands, filterInstagramPosts } from "@/lib/ai";
import { db, UserError } from "@/lib/db";
import { brandPosts, brandWithPosts, getConnection, hashtagPosts, lastOembedErrors, lastProfileErrors, postAuthor, profileInfo, type IgPost, type IgProfile } from "@/lib/instagram";
import { sendPush } from "@/lib/push";
import { MAX_DISCOVERED, readProfile, type RadarProfile } from "@/lib/radar";

const MAX_AGE_DAYS = 7;

export type RadarStats = { added: number; read: number; hashtagChecked: number; authorsFound: number; droppedPeople: number; droppedUnknown: number; errors: string[] };

/** Job giornaliero: monitoraggio + scoperta di brand nuovi in parallelo, poi una sola notifica. */
export async function runRadarForUser(userId: string): Promise<number> {
  const [a, b] = await Promise.allSettled([runRadar(userId), runDiscovery(userId)]);
  const added = (a.status === "fulfilled" ? a.value.added : 0) + (b.status === "fulfilled" ? b.value.added : 0);
  const discovered = b.status === "fulfilled" ? b.value.brands : 0;
  if (added > 0) {
    await sendPush(userId, {
      title: `Radar: ${added} ${added === 1 ? "nuovo post" : "nuovi post"} da commentare`,
      body: discovered > 0 ? `Ho scoperto ${discovered} brand nuovi nel tuo settore. Commenta per primo e fatti notare.` : "Brand del tuo target hanno appena pubblicato. Commenta per primo.",
    });
  }
  return added;
}

export async function runRadar(userId: string): Promise<RadarStats> {
  const stats: RadarStats = { added: 0, read: 0, hashtagChecked: 0, authorsFound: 0, droppedPeople: 0, droppedUnknown: 0, errors: [] };
  lastOembedErrors.length = 0;
  const [{ data: account, error }, conn] = await Promise.all([
    db().from("accounts").select("radar_profile, company_offer").eq("user_id", userId).single(),
    getConnection(userId),
  ]);
  if (error) throw error;
  if (!conn) throw new UserError("Collega prima il tuo profilo Instagram.");
  const profile = readProfile(account.radar_profile);
  if (!profile) throw new UserError("Imposta prima il profilo del Radar.");
  const ignored = new Set(profile.igIgnored);
  const followed = profile.igBrands.filter((b) => !ignored.has(b));
  const discovered = new Set(profile.igDiscovered.filter((b) => !ignored.has(b) && !followed.includes(b)));

  // 1) lettura da Instagram (in parallelo; un brand o hashtag che non risponde non blocca gli altri)
  const results = await Promise.allSettled([
    ...[...followed, ...discovered].map((b) => brandPosts(conn, b, 4)),
    ...profile.igHashtags.map((h) => hashtagPosts(conn, h)),
  ]);
  for (const r of results) if (r.status === "rejected") console.error("Radar Instagram", String(r.reason).slice(0, 200));
  const authError = results.find((r) => r.status === "rejected" && r.reason instanceof UserError);
  const since = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  let posts: IgPost[] = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((p) => !p.timestamp || new Date(p.timestamp).getTime() >= since)
    .filter((p) => !seen.has(p.url) && seen.add(p.url));
  if (posts.length === 0 && authError?.status === "rejected") throw authError.reason;
  stats.read = posts.length;

  // 2) niente doppioni: tolgo i post già nel Radar
  if (posts.length > 0) {
    const { data: existing } = await db().from("radar_items").select("url").eq("user_id", userId).in("url", posts.map((p) => p.url));
    const known = new Set((existing ?? []).map((e) => e.url as string));
    posts = posts.filter((p) => !known.has(p.url)).slice(0, 60);
  }
  if (posts.length === 0) {
    await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", userId);
    return stats;
  }

  // 3) l'AI tiene solo le occasioni vere
  const offer = account.company_offer || profile.topics.join(", ");
  const kept = await filterInstagramPosts({ offer, sectors: profile.sectors, topics: profile.topics, posts });
  // 4) post da hashtag: scopro l'autore e tengo solo i profili di brand/aziende (niente persone)
  const fromHashtag = kept.filter((k) => posts[k.i].source === "hashtag").slice(0, 25);
  const authors = new Map<number, string>();
  await Promise.all(
    fromHashtag.map(async (k) => {
      const a = await postAuthor(posts[k.i].url);
      if (a) authors.set(k.i, a);
    }),
  );
  const usernames = [...new Set(authors.values())];
  const profiles = (await Promise.all(usernames.map((u) => profileInfo(conn, u)))).filter((p): p is IgProfile => p !== null);
  const brands = await classifyBrandProfiles(profiles).catch(() => new Set<string>());
  stats.hashtagChecked = fromHashtag.length;
  stats.authorsFound = authors.size;
  const final = kept.filter((k) => {
    if (posts[k.i].source !== "hashtag") return true;
    const a = authors.get(k.i);
    // autore non verificabile: scartato (vogliamo solo brand certi)
    if (!a) {
      stats.droppedUnknown++;
      return false;
    }
    // profilo personale (Instagram non lo espone) o persona/creator: scartato
    if (!brands.has(a)) {
      stats.droppedPeople++;
      return false;
    }
    return true;
  });
  for (const [i, a] of authors) posts[i].author = a;

  const rows = final.map((k) => {
    const p = posts[k.i];
    return {
      user_id: userId,
      url: p.url,
      platform: "Instagram",
      signal: p.source === "hashtag" ? "hashtag" : discovered.has(p.author.toLowerCase()) ? "scoperto" : "brand",
      author: p.author,
      company: p.source === "hashtag" ? `#${p.hashtag}` : "",
      posted: p.timestamp,
      excerpt: p.caption.slice(0, 1200),
      why: k.why,
      intent: k.intent,
      likes: p.likes,
      comments: p.comments,
    };
  });
  let added = 0;
  if (rows.length > 0) {
    const { data, error: insError } = await db().from("radar_items").upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true }).select("id");
    if (insError) throw insError;
    added = data?.length ?? 0;
  }
  await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", userId);
  stats.added = added;
  stats.errors = [...lastOembedErrors];
  return stats;
}

export type DiscoveryStats = { added: number; proposed: number; verified: number; brands: number; sample: string[]; errors: string[] };

/**
 * Scoperta di brand nuovi: l'AI propone profili Instagram del settore, l'API di Instagram verifica che esistano
 * e siano professionali, l'AI tiene solo brand/aziende. I nuovi brand vengono monitorati da qui in avanti.
 */
export async function runDiscovery(userId: string): Promise<DiscoveryStats> {
  const stats: DiscoveryStats = { added: 0, proposed: 0, verified: 0, brands: 0, sample: [], errors: [] };
  lastProfileErrors.length = 0;
  const [{ data: account, error }, conn] = await Promise.all([
    db().from("accounts").select("radar_profile, company_offer").eq("user_id", userId).single(),
    getConnection(userId),
  ]);
  if (error) throw error;
  if (!conn) throw new UserError("Collega prima il tuo profilo Instagram.");
  const profile = readProfile(account.radar_profile);
  if (!profile) throw new UserError("Imposta prima il profilo del Radar.");
  const offer = account.company_offer || profile.topics.join(", ");
  if (!offer && profile.sectors.length === 0) throw new UserError("Indica settori e argomenti nel profilo del Radar.");

  const known = new Set([...profile.igBrands, ...profile.igDiscovered, ...profile.igIgnored, conn.ig_username.toLowerCase()]);
  const proposed = (await discoverInstagramBrands({ offer, sectors: profile.sectors, topics: profile.topics, exclude: [...known], count: 25 })).filter(
    (h) => !known.has(h),
  );
  stats.proposed = proposed.length;
  stats.sample = proposed.slice(0, 8);

  // verifica con Instagram: esiste ed è un profilo professionale?
  const checked = (await Promise.all(proposed.slice(0, 25).map((h) => brandWithPosts(conn, h, 4)))).filter(
    (x): x is NonNullable<typeof x> => x !== null,
  );
  stats.verified = checked.length;
  stats.errors = [...lastProfileErrors];
  // solo brand/aziende (niente persone o creator)
  const brands = await classifyBrandProfiles(checked.map((c) => c.profile)).catch(() => new Set<string>());
  const newBrands = checked.filter((c) => brands.has(c.profile.username.toLowerCase()));
  stats.brands = newBrands.length;
  if (newBrands.length === 0) return stats;

  // i nuovi brand restano nel Radar (i più vecchi escono se si supera il limite)
  const names = newBrands.map((c) => c.profile.username.toLowerCase());
  const updated: RadarProfile = { ...profile, igDiscovered: [...profile.igDiscovered, ...names].slice(-MAX_DISCOVERED) };
  await db().from("accounts").update({ radar_profile: updated }).eq("user_id", userId);

  // i loro post recenti (ultimi 30 giorni), filtrati dall'AI
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const posts = newBrands
    .flatMap((c) => c.posts.slice(0, 2))
    .filter((p) => !p.timestamp || new Date(p.timestamp).getTime() >= since);
  if (posts.length === 0) return stats;
  const { data: existing } = await db().from("radar_items").select("url").eq("user_id", userId).in("url", posts.map((p) => p.url));
  const seen = new Set((existing ?? []).map((e) => e.url as string));
  const fresh = posts.filter((p) => !seen.has(p.url));
  const kept = await filterInstagramPosts({ offer, sectors: profile.sectors, topics: profile.topics, posts: fresh });
  // almeno un post per ogni brand nuovo: anche se l'AI è severa, il brand scoperto va mostrato
  const keptIdx = new Map(kept.map((k) => [k.i, k]));
  const byBrand = new Set<string>();
  const rows = fresh
    .map((p, i) => ({ p, k: keptIdx.get(i) }))
    .filter(({ p, k }) => {
      if (k) return byBrand.add(p.author) || true;
      if (byBrand.has(p.author)) return false;
      byBrand.add(p.author);
      return true;
    })
    .map(({ p, k }) => ({
      user_id: userId,
      url: p.url,
      platform: "Instagram",
      signal: "scoperto",
      author: p.author,
      company: "",
      posted: p.timestamp,
      excerpt: p.caption.slice(0, 1200),
      why: k?.why || "Brand nuovo del tuo settore: commenta i suoi post per farti notare prima di scrivergli.",
      intent: k?.intent ?? 2,
      likes: p.likes,
      comments: p.comments,
    }));
  if (rows.length > 0) {
    const { data, error: insError } = await db().from("radar_items").upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true }).select("id");
    if (insError) throw insError;
    stats.added = data?.length ?? 0;
  }
  return stats;
}
