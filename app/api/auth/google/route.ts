// Accesso con Google (tramite Supabase Auth): porta l'utente alla pagina di Google.
// Dopo il consenso Google rimanda a /auth/callback, che crea la sessione di login.
import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/app") ? next : "/app";
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("Login Google", error?.message);
    return NextResponse.redirect(new URL("/login?errore=google", url.origin));
  }
  return NextResponse.redirect(data.url);
}
