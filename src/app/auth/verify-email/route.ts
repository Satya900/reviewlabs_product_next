import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailMatches, readVerificationToken } from "@/lib/email-verification";
import { PLATFORM_EVENT_COOKIE } from "@/lib/platform-pixel";
import { platformEventIds, sendRegistrationEvent, trackingFromRequest } from "@/lib/platform-meta";

// Target of the "Verify your email" link. Works without being signed in (the
// link may be opened on another device); the signed token says who it's for.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = (status: string) => NextResponse.redirect(new URL(`/dashboard?verify=${status}`, url.origin));

  const claim = readVerificationToken(url.searchParams.get("t") ?? "");
  if (!claim) return to("invalid");

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("id, email, email_verified_at").eq("id", claim.userId).maybeSingle();
  if (!profile || !emailMatches(claim, profile.email)) return to("invalid");
  if (profile.email_verified_at) return to("done");

  // Only the first click counts, so the signup conversion is sent once.
  const { data: updated } = await db
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("email_verified_at", null)
    .select("id")
    .maybeSingle();
  const response = to("done");
  if (updated) {
    // A verified signup is our ads' conversion. The server sends it now; the
    // cookie lets the dashboard fire the browser half with the same event ID.
    const tracking = trackingFromRequest(request, `${url.origin}/signup`);
    after(() => sendRegistrationEvent(profile.id, tracking).catch((e) => console.warn("[verify-email] registration event:", e)));
    response.cookies.set(PLATFORM_EVENT_COOKIE, `CompleteRegistration:${platformEventIds.registration(profile.id)}`, { path: "/", maxAge: 600, sameSite: "lax" });
  }
  return response;
}
