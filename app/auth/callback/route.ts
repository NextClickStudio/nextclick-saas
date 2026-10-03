// Ritorno da Google o dai link via email (recupero password): crea la sessione di login.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authClient } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  // solo percorsi interni dell'area utenti (niente "//sito" o "/\\sito" che i browser trattano come altri domini)
  const safeNext = /^\/app(\/[\w\-/?=&%.]*)?$/.test(next) ? next : "/app";
  if (code) {
    const supabase = await authClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // primo accesso (es. con Google): crea il profilo con la sessione di prova
      const meta = data.user.user_metadata ?? {};
      await db()
        .from("accounts")
        .upsert(
          {
            user_id: data.user.id,
            full_name: (meta.full_name as string) || (meta.name as string) || null,
            accepted_terms_at: new Date().toISOString(),
          },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
    console.error("Callback login", error?.message);
  }
  return NextResponse.redirect(new URL(`/login?errore=${url.searchParams.get("error") ? "google" : "link"}`, url.origin));
}
