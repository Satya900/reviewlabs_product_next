import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailMatches, readVerificationToken } from "@/lib/email-verification";

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

  await db
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("email_verified_at", null);
  return to("done");
}
