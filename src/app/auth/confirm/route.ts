import type { EmailOtpType } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_EVENT_COOKIE } from "@/lib/platform-pixel";
import { platformEventIds, sendRegistrationEvent, trackingFromRequest } from "@/lib/platform-meta";

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
      const response = NextResponse.redirect(new URL(destination, url.origin));
      // A verified signup is our ads' conversion. The server sends it now; the
      // cookie lets the dashboard fire the browser half with the same event ID.
      const userId = data.user?.id;
      if ((type === "email" || type === "signup") && userId) {
        const tracking = trackingFromRequest(request, `${url.origin}/signup`);
        after(() => sendRegistrationEvent(userId, tracking).catch((e) => console.warn("[auth/confirm] registration event:", e)));
        response.cookies.set(PLATFORM_EVENT_COOKIE, `CompleteRegistration:${platformEventIds.registration(userId)}`, { path: "/", maxAge: 600, sameSite: "lax" });
      }
      return response;
    }
    console.error("[auth/confirm]", error.message);
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
