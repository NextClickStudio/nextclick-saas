// Instagram tramite l'API ufficiale di Meta (Graph API con accesso Facebook).
// L'utente collega il suo profilo Instagram Business/Creator (legato a una Pagina Facebook);
// Yeppo legge gli ultimi post dei brand che segue (Business Discovery) e i post recenti sugli hashtag
// del suo settore (Hashtag Search). Nessuna pubblicazione automatica: i commenti li pubblica l'utente.
import "server-only";
import { db, UserError } from "@/lib/db";
import { SITE_URL } from "@/lib/config";

export const GRAPH = "https://graph.facebook.com/v23.0";
export const IG_SCOPES = ["instagram_basic", "pages_show_list", "pages_read_engagement", "business_management"];
export const IG_REDIRECT = `${SITE_URL}/api/instagram/callback`;

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function appCreds() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new UserError("Collegamento Instagram non ancora configurato (mancano le chiavi dell'app Meta).");
  return { id, secret };
}

export function loginUrl(state: string): string {
  const { id } = appCreds();
  // Facebook Login for Business usa una "configurazione" (config_id) creata nella dashboard Meta al posto dello scope
  const config = process.env.META_CONFIG_ID;
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: IG_REDIRECT,
    state,
    response_type: "code",
    ...(config ? { config_id: config, override_default_response_type: "true" } : { scope: IG_SCOPES.join(",") }),
  });
  return `https://www.facebook.com/v23.0/dialog/oauth?${q}`;
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${path.startsWith("http") ? path : GRAPH + path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || data.error) {
    const e = data.error;
    // 190 = token scaduto o revocato
    if (e?.code === 190) throw new UserError("Il collegamento con Instagram è scaduto: ricollegalo dal Radar.");
    throw new Error(`Graph ${res.status}: ${e?.message ?? "errore"} (${e?.code ?? "?"})`);
  }
  return data;
}

/** Dal codice del login Facebook al token di lunga durata (60 giorni) e al profilo Instagram collegato. */
export async function connectFromCode(userId: string, code: string): Promise<{ username: string }> {
  const { id, secret } = appCreds();
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: id,
    client_secret: secret,
    redirect_uri: IG_REDIRECT,
    code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  const pages = await graph<{ data: { id: string; name: string; instagram_business_account?: { id: string; username?: string } }[] }>(
    "/me/accounts",
    { access_token: long.access_token, fields: "id,name,instagram_business_account{id,username}", limit: "50" },
  );
  const page = pages.data.find((p) => p.instagram_business_account);
  if (!page?.instagram_business_account) {
    throw new UserError(
      "Non trovo un profilo Instagram Business o Creator collegato alle tue Pagine Facebook. Su Instagram: Impostazioni → Tipo di account → passa a professionale e collegalo a una Pagina.",
    );
  }
  const ig = page.instagram_business_account;
  const username = ig.username ?? (await graph<{ username: string }>(`/${ig.id}`, { access_token: long.access_token, fields: "username" })).username;
  const { error } = await db()
    .from("instagram_connections")
    .upsert({
      user_id: userId,
      ig_user_id: ig.id,
      ig_username: username,
      page_id: page.id,
      access_token: long.access_token,
      token_expires_at: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return { username };
}

export type IgConnection = { ig_user_id: string; ig_username: string; access_token: string; token_expires_at: string | null };

export async function getConnection(userId: string): Promise<IgConnection | null> {
  const { data } = await db()
    .from("instagram_connections")
    .select("ig_user_id, ig_username, access_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as IgConnection | null) ?? null;
}

export type IgPost = {
  url: string;
  author: string;
  caption: string;
  timestamp: string;
  likes: number | null;
  comments: number | null;
  source: "brand" | "hashtag";
  hashtag?: string;
};

type Media = { id: string; caption?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number };

/** Ultimi post di un profilo Business/Creator (Business Discovery). */
export async function brandPosts(conn: IgConnection, username: string, limit = 6): Promise<IgPost[]> {
  const handle = username.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return [];
  const data = await graph<{ business_discovery?: { username: string; media?: { data: Media[] } } }>(`/${conn.ig_user_id}`, {
    access_token: conn.access_token,
    fields: `business_discovery.username(${handle}){username,media.limit(${limit}){id,caption,permalink,timestamp,like_count,comments_count}}`,
  });
  const bd = data.business_discovery;
  return (bd?.media?.data ?? [])
    .filter((m) => m.permalink)
    .map((m) => ({
      url: m.permalink!,
      author: bd!.username,
      caption: m.caption ?? "",
      timestamp: m.timestamp ?? "",
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      source: "brand" as const,
    }));
}

/** Id di un hashtag (memorizzato: Instagram permette 30 hashtag diversi a settimana per account). */
async function hashtagId(conn: IgConnection, name: string): Promise<string | null> {
  const tag = name.replace(/^#/, "").trim().toLowerCase();
  if (!/^[\p{L}\p{N}_]{2,60}$/u.test(tag)) return null;
  const { data: cached } = await db().from("ig_hashtags").select("hashtag_id").eq("name", tag).maybeSingle();
  if (cached) return cached.hashtag_id as string;
  const res = await graph<{ data: { id: string }[] }>("/ig_hashtag_search", { user_id: conn.ig_user_id, q: tag, access_token: conn.access_token });
  const id = res.data[0]?.id;
  if (id) await db().from("ig_hashtags").upsert({ name: tag, hashtag_id: id });
  return id ?? null;
}

/** Post recenti (ultime 24 ore) con un hashtag. Instagram non fornisce l'autore dei post da hashtag. */
export async function hashtagPosts(conn: IgConnection, name: string, limit = 25): Promise<IgPost[]> {
  const id = await hashtagId(conn, name);
  if (!id) return [];
  const res = await graph<{ data: Media[] }>(`/${id}/recent_media`, {
    user_id: conn.ig_user_id,
    access_token: conn.access_token,
    fields: "id,caption,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return res.data
    .filter((m) => m.permalink)
    .map((m) => ({
      url: m.permalink!,
      author: "",
      caption: m.caption ?? "",
      timestamp: m.timestamp ?? "",
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      source: "hashtag" as const,
      hashtag: name.replace(/^#/, ""),
    }));
}

/**
 * Autore di un post (nome profilo) tramite oEmbed ufficiale di Meta, con il token dell'app.
 * Restituisce null se Meta non lo fornisce: in quel caso decide solo l'AI sul testo.
 */
export async function postAuthor(url: string): Promise<string | null> {
  try {
    const { id, secret } = appCreds();
    const data = await graph<{ author_name?: string; html?: string }>("/instagram_oembed", {
      url,
      access_token: `${id}|${secret}`,
      omitscript: "true",
    });
    const clean = (v?: string | null) => {
      const n = v?.replace(/^@/, "").trim().toLowerCase();
      return n && /^[a-z0-9._]{1,30}$/.test(n) ? n : null;
    };
    // a volte Meta non dà author_name: lo ricavo dall'HTML dell'anteprima ("(@nomeprofilo)" o link al profilo)
    const html = data.html ?? "";
    const fromHtml =
      html.match(/\(@([A-Za-z0-9._]{1,30})\)/)?.[1] ??
      html.match(/instagram\.com\/(?!p\/|reel\/|tv\/|explore\/)([A-Za-z0-9._]{1,30})\/?["?]/)?.[1];
    return clean(data.author_name) ?? clean(fromHtml);
  } catch (err) {
    console.error("oEmbed Instagram", err instanceof Error ? err.message.slice(0, 200) : err);
    return null;
  }
}

export type IgProfile = { username: string; name: string; biography: string; website: string; followers: number | null };

/** Profilo pubblico di un account Business/Creator; null se è un profilo personale (Instagram non lo espone). */
export async function profileInfo(conn: IgConnection, username: string): Promise<IgProfile | null> {
  try {
    const data = await graph<{ business_discovery?: { username: string; name?: string; biography?: string; website?: string; followers_count?: number } }>(
      `/${conn.ig_user_id}`,
      { access_token: conn.access_token, fields: `business_discovery.username(${username}){username,name,biography,website,followers_count}` },
    );
    const b = data.business_discovery;
    return b ? { username: b.username, name: b.name ?? "", biography: b.biography ?? "", website: b.website ?? "", followers: b.followers_count ?? null } : null;
  } catch (err) {
    if (err instanceof UserError) throw err; // collegamento scaduto
    return null;
  }
}

/** Profilo + ultimi post di un account Business/Creator in una sola chiamata; null se non esiste o è personale. */
export async function brandWithPosts(conn: IgConnection, username: string, limit = 4): Promise<{ profile: IgProfile; posts: IgPost[] } | null> {
  const handle = username.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  try {
    const data = await graph<{
      business_discovery?: { username: string; name?: string; biography?: string; website?: string; followers_count?: number; media?: { data: Media[] } };
    }>(`/${conn.ig_user_id}`, {
      access_token: conn.access_token,
      fields: `business_discovery.username(${handle}){username,name,biography,website,followers_count,media.limit(${limit}){id,caption,permalink,timestamp,like_count,comments_count}}`,
    });
    const b = data.business_discovery;
    if (!b) return null;
    return {
      profile: { username: b.username, name: b.name ?? "", biography: b.biography ?? "", website: b.website ?? "", followers: b.followers_count ?? null },
      posts: (b.media?.data ?? [])
        .filter((m) => m.permalink)
        .map((m) => ({
          url: m.permalink!,
          author: b.username,
          caption: m.caption ?? "",
          timestamp: m.timestamp ?? "",
          likes: m.like_count ?? null,
          comments: m.comments_count ?? null,
          source: "brand" as const,
        })),
    };
  } catch (err) {
    if (err instanceof UserError) throw err;
    return null;
  }
}
