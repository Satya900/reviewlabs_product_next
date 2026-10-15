import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ magnetId: z.uuid() });
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless/i;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (BOT.test(request.headers.get("user-agent") ?? "")) return NextResponse.json({ ok: true });
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`lmview:${ip}:${parsed.data.magnetId}`, 5, 3600))) return NextResponse.json({ ok: true });
  const { error } = await createAdminClient().rpc("record_lead_magnet_view", { p_magnet_id: parsed.data.magnetId });
  if (error) console.error("[lead views]", error.message);
  return NextResponse.json({ ok: true });
}
