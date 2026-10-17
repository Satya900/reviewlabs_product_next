import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runDailyPayouts, syncOpenPayouts } from "@/lib/payouts";

export const maxDuration = 60;

// Daily: settle open payouts first, then pay every creator their available balance.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const synced = await syncOpenPayouts();
  const daily = await runDailyPayouts();
  return NextResponse.json({ synced, daily });
}
