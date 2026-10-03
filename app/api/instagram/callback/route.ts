// Ritorno dal login Facebook: verifica, salva il collegamento Instagram e torna al Radar.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectFromCode } from "@/lib/instagram";
import { SITE_URL } from "@/lib/config";
import { UserError } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const back = (q: string) => NextResponse.redirect(`${SITE_URL}/app/radar?${q}`);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/app/radar`);
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("yeppo_ig_state")?.value;
  jar.delete("yeppo_ig_state");
  if (params.get("error")) return back(`ig_error=${encodeURIComponent("Collegamento annullato.")}`);
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected) return back(`ig_error=${encodeURIComponent("Collegamento non valido o scaduto: riprova.")}`);
  try {
    const { username } = await connectFromCode(user.id, code);
    return back(`ig=${encodeURIComponent(username)}`);
  } catch (err) {
    console.error("Collegamento Instagram", err instanceof Error ? err.message : err);
    const msg = err instanceof UserError ? err.message : "Collegamento con Instagram non riuscito. Riprova tra poco.";
    return back(`ig_error=${encodeURIComponent(msg)}`);
  }
}
