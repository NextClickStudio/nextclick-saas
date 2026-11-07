import type { Metadata } from "next";
import Home from "@/components/Home";

export const metadata: Metadata = { alternates: { canonical: "/" } };
export const revalidate = 600;

export default function Page() {
  return <Home />;
}
