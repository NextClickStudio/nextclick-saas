import type { Metadata } from "next";
import Locker from "@/components/Locker";

export const metadata: Metadata = { title: "Profile · yeppo royale" };

export default function Page() {
  return <Locker />;
}
