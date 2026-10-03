// Esegue il Radar di un utente: legge Instagram, filtra con l'AI, salva le novità e manda la notifica.
import "server-only";
import { filterInstagramPosts } from "@/lib/ai";
import { db, UserError } from "@/lib/db";
import { brandPosts, getConnection, hashtagPosts, type IgPost } from "@/lib/instagram";
import { sendPush } from "@/lib/push";
import { readProfile } from "@/lib/radar";

const MAX_AGE_DAYS = 7;

export async function runRadarForUser(userId: string, opts: { notify?: boolean } = {}): Promise<number> {
  const [{ data: account, error }, conn] = await Promise.all([
    db().from("accounts").select("radar_profile, company_offer").eq("user_id", userId).single(),
    getConnection(userId),
  ]);
  if (error) throw error;
  if (!conn) throw new UserError("Collega prima il tuo profilo Instagram.");
  const profile = readProfile(account.radar_profile);
  if (!profile || (profile.igBrands.length === 0 && profile.igHashtags.length === 0)) {
    throw new UserError("Aggiungi almeno un brand da seguire o un hashtag nel profilo del Radar.");
  }

  // 1) lettura da Instagram (in parallelo; un brand o hashtag che non risponde non blocca gli altri)
  const results = await Promise.allSettled([
    ...profile.igBrands.map((b) => brandPosts(conn, b)),
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

  // 2) niente doppioni: tolgo i post già nel Radar
  if (posts.length > 0) {
    const { data: existing } = await db().from("radar_items").select("url").eq("user_id", userId).in("url", posts.map((p) => p.url));
    const known = new Set((existing ?? []).map((e) => e.url as string));
    posts = posts.filter((p) => !known.has(p.url)).slice(0, 60);
  }
  if (posts.length === 0) {
    await db().from("accounts").update({ radar_last_run_at: new Date().toISOString() }).eq("user_id", userId);
    return 0;
  }

  // 3) l'AI tiene solo le occasioni vere
  const offer = account.company_offer || profile.topics.join(", ");
  const kept = await filterInstagramPosts({ offer, sectors: profile.sectors, topics: profile.topics, posts });
  const rows = kept.map((k) => {
    const p = posts[k.i];
    return {
      user_id: userId,
      url: p.url,
      platform: "Instagram",
      signal: p.source === "brand" ? "brand" : "hashtag",
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
  if (added > 0 && opts.notify) {
    await sendPush(userId, {
      title: `Radar: ${added} ${added === 1 ? "nuovo post" : "nuovi post"} da commentare`,
      body: "Brand del tuo target hanno appena pubblicato. Commenta per primo e fatti notare.",
    });
  }
  return added;
}
