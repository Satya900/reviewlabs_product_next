import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Fixed-window limiter in Postgres. Fails open: a database hiccup should not
// block a buyer from paying.
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}

export const tooManyRequests = { error: "Too many attempts. Please wait a few minutes and try again." };
