import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Accesso", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-gray-200 p-6">
          <h1 className="mb-1 text-lg font-semibold">Area riservata</h1>
          <p className="mb-5 text-sm text-gray-600">Inserisci la password per continuare.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
