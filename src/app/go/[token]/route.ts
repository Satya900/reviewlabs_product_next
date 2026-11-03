import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// The link inside an AutoDM: counts the click, then opens the product.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{16}$/.test(token)) return NextResponse.redirect(new URL("/", request.url));
  const { data: url } = await createAdminClient().rpc("record_dm_click", { p_token: token });
  // Only https links (custom links are checked when saved) or our own pages.
  const safe = typeof url === "string" && (url.startsWith("https://") || url.startsWith(`${env.appUrl()}/`));
  return NextResponse.redirect(safe ? url : new URL("/", request.url));
}
