import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMetaEvent } from "@/lib/meta";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  pageId: z.uuid(),
  eventName: z.enum(["PageView", "ViewContent"]),
  eventId: z.string().min(8).max(100),
  sourceUrl: z.url().max(2000).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(400).optional(),
});

// Server-side mirror of browser Pixel page events (same eventId for dedup).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const input = parsed.data;
  if (!(await rateLimit(`track:${clientIp(request.headers) ?? "unknown"}`, 60, 60))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const { data: page } = await createAdminClient()
    .from("payment_pages")
    .select("id, creator_id, title, amount_paise, currency")
    .eq("id", input.pageId)
    .eq("status", "live")
    .maybeSingle();
  if (!page) return NextResponse.json({ ok: false }, { status: 404 });

  const tracking = {
    fbp: input.fbp,
    fbc: input.fbc,
    source_url: input.sourceUrl,
    client_ip: clientIp(request.headers),
    user_agent: request.headers.get("user-agent") ?? undefined,
  };

  after(async () => {
    const result = await sendMetaEvent({ creatorId: page.creator_id, pageId: page.id }, {
      eventName: input.eventName,
      eventId: input.eventId,
      tracking,
      customData:
        input.eventName === "ViewContent"
          ? { content_ids: [page.id], content_name: page.title, content_type: "product", value: page.amount_paise / 100, currency: page.currency }
          : undefined,
    });
    if (result.status === "failed") console.warn(`[track] ${input.eventName} failed:`, result.error);
  });

  return NextResponse.json({ ok: true });
}
