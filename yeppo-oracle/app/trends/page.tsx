import { redirect } from "next/navigation";

// the radar and meme-wave scanner are gone (3 Nov 2026): yeppo reads a coin when you open it
export default function Page() {
  redirect("/");
}
