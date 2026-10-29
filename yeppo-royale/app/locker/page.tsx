import type { Metadata } from "next";
import Locker from "@/components/Locker";

export const metadata: Metadata = { title: "Profile picture · yeppo 1v1" };

export default function Page() {
  return <Locker />;
}
