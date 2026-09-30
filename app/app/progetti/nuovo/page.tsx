import type { Metadata } from "next";
import NewProjectWizard from "./wizard";

export const metadata: Metadata = { title: "Nuovo progetto" };

export default function NewProjectPage() {
  return <NewProjectWizard />;
}
