import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export let supabaseConfigError: string | null = null;
export let supabase: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseConfigError =
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.";
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    supabaseConfigError = "Invalid Supabase browser configuration.";
  }
}
