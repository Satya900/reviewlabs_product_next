import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { loginUrl } from "@/lib/instagram";
import { STATE_COOKIE, newLoginState, redirectUri } from "@/lib/instagram-connect";

// "Connect Instagram": off to Meta's login, where the creator picks the
// Instagram account. Meta sends them back to /api/instagram/callback.
export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL("/login?next=/dashboard/autodm", request.url));
  if (!env.autodmEnabled()) return NextResponse.redirect(new URL("/dashboard/autodm?ig=unavailable", request.url));

  const { state, nonce } = newLoginState(profile.id);
  const response = NextResponse.redirect(loginUrl(redirectUri(), state));
  response.cookies.set(STATE_COOKIE, nonce, { httpOnly: true, secure: env.appUrl().startsWith("https"), sameSite: "lax", path: "/api/instagram", maxAge: 900 });
  return response;
}
