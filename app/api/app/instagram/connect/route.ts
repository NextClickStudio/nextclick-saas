// Avvia il collegamento di Instagram: login Facebook ufficiale con i permessi di sola lettura.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginUrl, metaConfigured } from "@/lib/instagram";
import { SITE_URL } from "@/lib/config";
import { requireUser } from "@/lib/supabase-auth";

export async function GET() {
  await requireUser();
  if (!metaConfigured()) return NextResponse.redirect(`${SITE_URL}/app/radar?ig_error=${encodeURIComponent("Collegamento Instagram non ancora attivo: manca la configurazione dell'app Meta.")}`);
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("yeppo_ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(loginUrl(state));
}

// Scollega Instagram (cancella il token salvato).
export async function DELETE() {
  const user = await requireUser();
  const { db } = await import("@/lib/db");
  await db().from("instagram_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
