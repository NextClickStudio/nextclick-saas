import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { supabaseServer } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: house } = await supabase.from("maison_houses").select("user_id").eq("user_id", user.id).maybeSingle();
  if (house) redirect("/home");
  const first = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";
  return <OnboardingForm firstName={first} />;
}
