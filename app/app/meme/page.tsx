import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccount, getCurrentUser } from "@/lib/supabase-auth";
import MemeStudio from "./meme-studio";

export const metadata: Metadata = { title: "Meme studio" };

// Strumento interno per i social di Yeppo: visibile solo agli account illimitati.
export default async function MemePage() {
  const user = (await getCurrentUser())!;
  if (!(await getAccount(user.id)).unlimited) notFound();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-500">Solo per te · social di Yeppo</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Meme studio</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          L&apos;AI scrive i copioni &quot;typical chat con il bro&quot;, tu li ritocchi e scarichi il video verticale già animato. Poi in CapCut aggiungi i
          suoni nei secondi indicati.
        </p>
      </div>
      <MemeStudio />
    </div>
  );
}
