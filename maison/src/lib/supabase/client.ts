import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for the browser (client components). */
export function supabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
