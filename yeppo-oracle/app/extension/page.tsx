import type { Metadata } from "next";
import ExtensionPage from "@/components/ExtensionPage";

export const metadata: Metadata = {
  title: "Browser extension · yeppo",
  description: "yeppo spots the memecoin you are looking at on pump.fun, GMGN, Axiom, Photon, BullX or DexScreener and tells you what usually happens next.",
};

export default function Page() {
  return <ExtensionPage />;
}
