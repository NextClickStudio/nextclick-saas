// Protegge l'area riservata (/app) e le API di amministrazione (/api/admin).
// Nota: in Next.js 16 il file "middleware.ts" si chiama "proxy.ts" (stessa funzione).
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessione scaduta: effettua di nuovo l'accesso." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/api/admin/:path*"],
};
