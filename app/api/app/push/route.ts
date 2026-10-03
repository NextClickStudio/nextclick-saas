// Notifiche push: chiave pubblica (GET) e registrazione del dispositivo (POST).
import { z } from "zod";
import { handle, readBody } from "@/lib/api";
import { db } from "@/lib/db";
import { sendPush, vapidPublicKey } from "@/lib/push";
import { requireUser } from "@/lib/supabase-auth";

export async function GET() {
  return handle(async () => {
    await requireUser();
    return { publicKey: await vapidPublicKey() };
  });
}

const schema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const sub = await readBody(request, schema);
    const { error } = await db()
      .from("push_subscriptions")
      .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
    if (error) throw error;
    await sendPush(user.id, { title: "Notifiche attive ✓", body: "Ti avviso qui quando il Radar trova nuove opportunità." });
    return { ok: true };
  });
}
