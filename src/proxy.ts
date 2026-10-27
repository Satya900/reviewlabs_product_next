import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { FBC_COOKIE, FBC_MAX_AGE, fbcFor } from "@/lib/fbclid";

const SESSION_PATHS = /^\/(dashboard|admin|login|signup|forgot-password|reset-password|auth)(\/|$)/;

export async function proxy(request: NextRequest) {
  const response = SESSION_PATHS.test(request.nextUrl.pathname) ? await updateSession(request) : NextResponse.next();

  // Landing from a Meta ad: remember the click, even if the Pixel is blocked.
  const fbc = fbcFor(request.nextUrl.searchParams.get("fbclid"), request.cookies.get(FBC_COOKIE)?.value);
  if (fbc) response.cookies.set(FBC_COOKIE, fbc, { path: "/", maxAge: FBC_MAX_AGE, sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/admin/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/:path*",
    // Any page opened from a Meta ad (homepage, pricing, creators' product pages).
    { source: "/((?!api|_next/static|_next/image|monitoring|favicon.ico|sitemap.xml|robots.txt).*)", has: [{ type: "query", key: "fbclid" }] },
  ],
};
