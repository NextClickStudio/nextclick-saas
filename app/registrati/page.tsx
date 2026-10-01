import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth-shell";
import { COMPANIES_PER_FREE_SESSION } from "@/lib/plans";
import RegisterForm from "./register-form";

export const metadata: Metadata = { title: "Crea il tuo account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea il tuo account"
      subtitle={`Include 1 sessione gratuita fino a ${COMPANIES_PER_FREE_SESSION} aziende. Nessuna carta richiesta.`}
      footer={
        <>
          Hai già un account? <Link href="/login" className="font-medium text-[#c4b8ff] hover:text-white">Accedi</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
