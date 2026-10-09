import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCoupon } from "@/lib/coupons";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({ pageId: z.uuid(), code: z.string().min(1).max(40) });

export async function POST(request: Request) {
  // Stops people guessing codes by brute force.
  if (!(await rateLimit(`coupon:${clientIp(request.headers) ?? "unknown"}`, 15, 600))) {
    return NextResponse.json(tooManyRequests, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a coupon code" }, { status: 400 });

  const { data: page } = await createAdminClient()
    .from("payment_pages")
    .select("id, creator_id, amount_paise")
    .eq("id", parsed.data.pageId)
    .eq("status", "live")
    .maybeSingle();
  if (!page) return NextResponse.json({ error: "This page is not available" }, { status: 404 });

  const result = await applyCoupon(page, parsed.data.code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ code: result.coupon.code, discountPaise: result.discountPaise, finalPaise: result.finalPaise });
}
