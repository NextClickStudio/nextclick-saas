// yeppo.it/api/discord/sweep (Vercel cron, daily): takes the Pro role back from Discord accounts whose key ran out. The
// database hands over only accounts whose key has really ended (and forgets them), so calling it early does no harm.
import { DB_HEADERS } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";
import { removeRole, ROLE_PRO } from "@/lib/discord";

export const runtime = "nodejs";

export async function GET() {
  let users: string[] = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_discord_expired_s`, { method: "POST", headers: DB_HEADERS, body: "{}", signal: AbortSignal.timeout(5000) });
    if (r.ok) users = ((await r.json()) as string[]) ?? [];
  } catch {
    /* next run */
  }
  let removed = 0;
  for (const u of users.slice(0, 200)) if (await removeRole(u, ROLE_PRO)) removed++;
  return Response.json({ expired: users.length, removed });
}
