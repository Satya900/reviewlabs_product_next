import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";

// Deducts the monthly plan from every active creator's balance.
// Idempotent per month, so running it twice is harmless.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
  const { data, error } = await createAdminClient().rpc("charge_subscriptions", { p_month: month });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ month, charged: data });
}
