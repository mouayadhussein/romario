import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client — public anon key only.
 * Never put SUPABASE_SERVICE_ROLE_KEY in NEXT_PUBLIC_* or import admin client here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing public Supabase configuration");
  }

  return createBrowserClient<Database>(url, key);
}
