import { createClient } from "@supabase/supabase-js";
import { isAddress, getAddress } from "viem";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a scoped Supabase client with sanitized request headers.
 * SECURITY NOTICE:
 * Client-side requests with anonymous keys should not be treated as authoritative
 * for row-level security without cryptographic token verification (e.g. Supabase JWT).
 * Setting unverified headers in the client browser does not establish an authorization boundary.
 * Sensitive workspace data must be queried through authenticated server routes (/api/*).
 */
export function getSupabaseClient(userIdOrWallet?: string) {
  if (!userIdOrWallet) {
    return supabase;
  }

  const sanitized = userIdOrWallet.trim();
  // Reject CRLF or null bytes to prevent HTTP header injection
  if (!sanitized || /[\r\n\0]/.test(sanitized)) {
    return supabase;
  }

  const normalizedWallet = isAddress(sanitized)
    ? getAddress(sanitized).toLowerCase()
    : sanitized.toLowerCase();

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-user-id": sanitized,
        "x-wallet-address": normalizedWallet,
      },
    },
  });
}
