// Notifiche push sul telefono/computer (Web Push): Yeppo si installa come app e avvisa delle nuove opportunità.
import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import { getOrCreateSecret } from "@/lib/secrets";

type Vapid = { publicKey: string; privateKey: string };

async function vapid(): Promise<Vapid> {
  const raw = await getOrCreateSecret("vapid", () => JSON.stringify(webpush.generateVAPIDKeys()));
  return JSON.parse(raw) as Vapid;
}

export async function vapidPublicKey(): Promise<string> {
  return (await vapid()).publicKey;
}

/** Invia una notifica a tutti i dispositivi dell'utente; elimina gli abbonamenti scaduti. */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }): Promise<number> {
  const keys = await vapid();
  const supabase = db();
  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, url: payload.url ?? "/app/radar" }),
        { vapidDetails: { subject: SITE_URL.startsWith("https") ? SITE_URL : "mailto:info@yeppo.it", publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("Notifica non inviata", status);
    }
  }
  return sent;
}
