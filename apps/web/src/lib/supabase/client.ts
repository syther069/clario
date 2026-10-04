import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseClient(userIdOrWallet?: string) {
  if (!userIdOrWallet) {
    return supabase;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-user-id": userIdOrWallet,
        "x-wallet-address": userIdOrWallet.toLowerCase(),
      },
    },
  });
}
