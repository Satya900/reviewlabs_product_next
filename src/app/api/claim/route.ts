import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { runPostPaymentTasks } from "@/lib/fulfilment";
import type { PageField } from "@/lib/types";

const schema = z.object({
  pageId: z.uuid(),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email").max(200),
  responses: z.record(z.string(), z.string().max(2000)).default({}),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(400).optional(),
  sourceUrl: z.url().max(2000).optional(),
});

// Lead magnets: a live free page gives its files for a name and email.
export async function POST(request: Request) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`claim:ip:${ip}`, 15, 600))) return NextResponse.json(tooManyRequests, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const input = parsed.data;
  if (!(await rateLimit(`claim:email:${input.email.toLowerCase()}`, 10, 3600))) return NextResponse.json(tooManyRequests, { status: 429 });

  const admin = createAdminClient();
  const { data: page } = await admin.from("payment_pages").select("id, is_free").eq("id", input.pageId).eq("status", "live").maybeSingle();
  if (!page?.is_free) return NextResponse.json({ error: "This page is not available" }, { status: 404 });

  // Same checks as paid checkout for the creator's extra questions.
  const { data: fields } = await admin.from("page_fields").select("*").eq("page_id", page.id).order("position");
  const responses: Record<string, string> = {};
  for (const field of (fields ?? []) as PageField[]) {
    const value = (input.responses[field.id] ?? "").trim();
    if (!value) {
      if (field.required) return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
      continue;
    }
    if (field.field_type === "select" && !field.options.includes(value)) {
      return NextResponse.json({ error: `Pick a valid option for ${field.label}` }, { status: 400 });
    }
    responses[field.label] = value;
  }

  const ttl = env.downloadTtlDays();
  const { data, error } = await admin
    .rpc("claim_free_product", {
      p_page_id: page.id,
      p_name: input.name,
      p_email: input.email,
      p_phone: "",
      p_responses: responses,
      p_tracking: {
        fbp: input.fbp,
        fbc: input.fbc,
        source_url: input.sourceUrl,
        client_ip: ip === "unknown" ? undefined : ip,
        user_agent: request.headers.get("user-agent") ?? undefined,
      },
      p_grant_ttl: ttl ? `${ttl} days` : null,
      p_max_downloads: env.downloadMaxPerGrant(),
    })
    .single<{ order_id: string; newly_created: boolean }>();
  if (error || !data) {
    console.error("[claim]", error?.message);
    return NextResponse.json({ error: "Couldn't get your download ready. Please try again." }, { status: 500 });
  }
  // Delivery email and Meta Lead event; repeat claims don't resend.
  if (data.newly_created) after(() => runPostPaymentTasks(data.order_id));
  return NextResponse.json({ orderId: data.order_id });
}
