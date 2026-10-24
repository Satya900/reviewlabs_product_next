import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { downloadLinksEmail } from "@/lib/fulfilment";
import { orderFiles, orderLinks } from "@/lib/order-files";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({ email: z.email().max(200) });
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

// Always responds the same way so it can't be used to probe who bought what.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const ipAllowed = await rateLimit(`resend:ip:${clientIp(request.headers) ?? "unknown"}`, 10, 3600);
  const emailAllowed = await rateLimit(`resend:email:${email}`, 5, 3600);
  if (!ipAllowed || !emailAllowed) return NextResponse.json(tooManyRequests, { status: 429 });
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select("id, page_id, page_title, offer_id, download_grants(id, token, last_resent_at)")
    .eq("buyer_email", email)
    .in("status", ["paid", "partially_refunded"])
    .order("created_at", { ascending: false })
    .limit(25);

  const items: { title: string; url: string }[] = [];
  const now = Date.now();
  for (const order of orders ?? []) {
    const grant = Array.isArray(order.download_grants) ? order.download_grants[0] : order.download_grants;
    if (!grant) continue;
    if (grant.last_resent_at && now - new Date(grant.last_resent_at).getTime() < RESEND_COOLDOWN_MS) continue;
    const [files, links] = await Promise.all([orderFiles(order), orderLinks(order)]);
    if (!files.length && !links.length) continue;

    await admin
      .from("download_grants")
      .update({
        expires_at: (() => {
          const ttl = env.downloadTtlDays();
          return ttl ? new Date(now + ttl * 86_400_000).toISOString() : null;
        })(),
        download_count: 0,
        last_resent_at: new Date(now).toISOString(),
      })
      .eq("id", grant.id);
    items.push({ title: order.page_title, url: `${env.appUrl()}/d/${grant.token}` });
  }

  if (items.length) {
    try {
      await sendEmail(downloadLinksEmail(email, items));
    } catch (e) {
      console.error("[download/resend]", e);
    }
  }
  return NextResponse.json({ ok: true });
}
