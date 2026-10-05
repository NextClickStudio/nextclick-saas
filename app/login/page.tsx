import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/auth-shell";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Accedi", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bentornato"
      subtitle="Accedi al tuo spazio Yeppo."
      footer={
        <>
          Non hai un account? <Link href="/registrati" className="font-medium text-[#c4b8ff] hover:text-white">Registrati gratis</Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
