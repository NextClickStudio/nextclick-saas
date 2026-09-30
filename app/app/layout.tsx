import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <header className="no-print border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo href="/app" />
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/app" className="rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-100">
              Progetti
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-100">Esci</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
