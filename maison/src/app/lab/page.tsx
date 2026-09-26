import type { Metadata } from "next";
import { LabClient } from "./LabClient";

export const metadata: Metadata = {
  title: "Atelier Lab — Maison",
};

export default function LabPage() {
  return <LabClient />;
}
