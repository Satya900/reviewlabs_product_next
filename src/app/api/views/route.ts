import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ pageId: z.uuid() });
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless/i;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (BOT.test(request.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true });

  // One person refreshing a page all day shouldn't inflate the numbers.
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`view:${ip}:${parsed.data.pageId}`, 5, 3600))) return NextResponse.json({ ok: true });

  const { error } = await createAdminClient().rpc("record_page_view", { p_page_id: parsed.data.pageId });
  if (error) console.error("[views]", error.message);
  return NextResponse.json({ ok: true });
}
