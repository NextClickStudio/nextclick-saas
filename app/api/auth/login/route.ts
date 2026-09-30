import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, SESSION_DAYS, checkPassword, createSessionToken } from "@/lib/auth";
import { handle, readBody } from "@/lib/api";
import { UserError } from "@/lib/db";

export async function POST(request: Request) {
  return handle(async () => {
    if (!process.env.ADMIN_PASSWORD) {
      throw new UserError("Configurazione mancante: imposta ADMIN_PASSWORD.");
    }
    const { password } = await readBody(request, z.object({ password: z.string().max(200) }));
    if (!(await checkPassword(password))) {
      // piccola pausa per rendere inutili i tentativi a raffica
      await new Promise((r) => setTimeout(r, 1000));
      throw new UserError("Password errata.");
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, await createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return res;
  });
}
