import type { Metadata } from "next";
import Admin from "@/components/Admin";

export const metadata: Metadata = { title: "Crea stanza — yeppo", robots: { index: false } };

export default function AdminPage() {
  return <Admin />;
}
