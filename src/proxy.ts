import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { ATTR_COOKIE, CLICK_MAX_AGE, FBC_COOKIE, attributionFrom, fbcFor } from "@/lib/ad-click";

const SESSION_PATHS = /^\/(dashboard|admin|invoices|login|signup|forgot-password|reset-password|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  const response = SESSION_PATHS.test(request.nextUrl.pathname) ? await updateSession(request) : NextResponse.next();

  // Landing from an ad: remember the click and its UTM tags for the signup,
  // even if the Pixel is blocked.
  const cookie = { path: "/", maxAge: CLICK_MAX_AGE, sameSite: "lax", secure: request.nextUrl.protocol === "https:" } as const;
  const fbc = fbcFor(request.nextUrl.searchParams.get("fbclid"), request.cookies.get(FBC_COOKIE)?.value);
  if (fbc) response.cookies.set(FBC_COOKIE, fbc, cookie);
  const attribution = attributionFrom(request.nextUrl);
  if (attribution) response.cookies.set(ATTR_COOKIE, JSON.stringify(attribution), { ...cookie, httpOnly: true });
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/admin/:path*", "/invoices/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/:path*",
    // Any page opened from an ad or a tagged link (homepage, pricing, ...).
    { source: "/((?!api|_next/static|_next/image|monitoring|favicon.ico|sitemap.xml|robots.txt).*)", has: [{ type: "query", key: "fbclid" }] },
    { source: "/((?!api|_next/static|_next/image|monitoring|favicon.ico|sitemap.xml|robots.txt).*)", has: [{ type: "query", key: "utm_source" }] },
  ],
};
