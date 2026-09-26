import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/AdminPanel";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: isAdmin } = await supabase.rpc("maison_is_admin");
  if (!isAdmin) redirect("/home");

  const [{ data: trends }, { data: runs }] = await Promise.all([
    supabase.from("maison_trends").select("id, name, family, query, value, day_open, source, updated_at, active").order("family").order("name"),
    supabase.rpc("maison_admin_runs", { lim: 15 }),
  ]);
  return <AdminPanel trends={trends ?? []} runs={runs ?? []} />;
}
