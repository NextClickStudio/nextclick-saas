// Job giornaliero (Vercel Cron): niente ricerche automatiche, solo un promemoria a chi non ha ancora fatto la ricerca di oggi.
import { db } from "@/lib/db";
import { sendPush } from "@/lib/push";

export const maxDuration = 60;

export async function GET() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }); // AAAA-MM-GG
  const { data: conns, error } = await db().from("instagram_connections").select("user_id").limit(1000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const ids = (conns ?? []).map((c) => c.user_id as string);
  if (ids.length === 0) return Response.json({ reminded: 0 });
  const { data: accounts } = await db()
    .from("accounts")
    .select("user_id, radar_runs_day, radar_reminded_day")
    .in("user_id", ids)
    .not("radar_profile", "is", null);
  const toRemind = (accounts ?? []).filter((a) => a.radar_runs_day !== today && a.radar_reminded_day !== today);
  if (toRemind.length > 0) {
    await db().from("accounts").update({ radar_reminded_day: today }).in("user_id", toRemind.map((a) => a.user_id as string));
  }
  let reminded = 0;
  await Promise.all(
    toRemind.map(async (a) => {
      reminded += (await sendPush(a.user_id as string, {
        title: "Il Radar di oggi ti aspetta 🔎",
        body: "Scopri i brand nuovi del tuo settore e commenta per primo i loro post.",
        url: "/app/radar",
      })) > 0 ? 1 : 0;
    }),
  );
  return Response.json({ reminded });
}
