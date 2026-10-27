import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Target of every auth email (verify signup, reset password, change email).
// Uses token_hash, so links work even on a different device or browser.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const destination = type === "recovery" ? "/reset-password" : next;
      const userId = data.user?.id;
      if ((type === "email" || type === "signup") && userId) {
        // Links from before instant signup (migration 0019) still verify the account.
        await createAdminClient().from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", userId).is("email_verified_at", null);
      }
      return NextResponse.redirect(new URL(destination, url.origin));
    }
    console.error("[auth/confirm]", error.message);
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
