import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { codeHash, runLeadTasks } from "@/lib/lead-delivery";
import { phoneDigits, type LeadQuestion } from "@/lib/lead-magnets";

const schema = z.object({
  magnetId: z.uuid(),
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email").max(200),
  phone: z.string().max(30).default(""),
  answers: z.record(z.string(), z.string().max(2000)).default({}),
  code: z.string().max(10).optional(),
  company: z.string().max(200).optional(), // honeypot
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(400).optional(),
  sourceUrl: z.url().max(2000).optional(),
});

// A visitor submits a lead magnet form.
export async function POST(request: Request) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`lead:ip:${ip}`, 20, 600))) return NextResponse.json(tooManyRequests, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const input = parsed.data;
  if (input.company) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  const email = input.email.toLowerCase();

  const admin = createAdminClient();
  const { data: magnet } = await admin
    .from("lead_magnets")
    .select("id, creator_id, collect_phone, phone_required, verify_email")
    .eq("id", input.magnetId)
    .eq("status", "live")
    .maybeSingle();
  if (!magnet) return NextResponse.json({ error: "This form isn't available" }, { status: 404 });

  let phone = "";
  if (magnet.collect_phone) {
    phone = phoneDigits(input.phone);
    if (phone && (phone.length < 10 || phone.length > 15)) return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    if (!phone && magnet.phone_required) return NextResponse.json({ error: "Enter your phone number" }, { status: 400 });
  }

  const { data: questions } = await admin.from("lead_magnet_questions").select("*").eq("magnet_id", magnet.id).order("position");
  const answers: Record<string, string> = {};
  for (const q of (questions ?? []) as LeadQuestion[]) {
    const value = (input.answers[q.id] ?? "").trim();
    if (!value) {
      if (q.required) return NextResponse.json({ error: `${q.label} is required` }, { status: 400 });
      continue;
    }
    if (q.field_type === "number" && !Number.isFinite(Number(value))) return NextResponse.json({ error: `${q.label} must be a number` }, { status: 400 });
    if (q.field_type === "select" && !q.options.includes(value)) return NextResponse.json({ error: `Pick a valid option for ${q.label}` }, { status: 400 });
    answers[q.label] = value;
  }

  if (magnet.verify_email) {
    if (!input.code) return NextResponse.json({ needsCode: true }, { status: 409 });
    const { data: row } = await admin
      .from("lead_email_codes")
      .select("id, code_hash, attempts, expires_at")
      .eq("magnet_id", magnet.id)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) {
      return NextResponse.json({ error: "That code has expired. Send a new one." }, { status: 400 });
    }
    if (row.code_hash !== codeHash(magnet.id, email, input.code.trim())) {
      await admin.from("lead_email_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return NextResponse.json({ error: "That code isn't right. Check your email and try again." }, { status: 400 });
    }
    await admin.from("lead_email_codes").delete().eq("id", row.id);
  }

  // One response per email; asking again just returns the same downloads.
  const { data: existing } = await admin
    .from("lead_responses")
    .select("id, download_token")
    .eq("magnet_id", magnet.id)
    .ilike("email", email)
    .maybeSingle();
  if (existing) return NextResponse.json({ responseId: existing.id, token: existing.download_token, repeat: true });

  const { data: created, error } = await admin
    .from("lead_responses")
    .insert({
      magnet_id: magnet.id,
      creator_id: magnet.creator_id,
      name: input.name,
      email,
      phone,
      answers,
      email_verified: magnet.verify_email,
      tracking: {
        fbp: input.fbp,
        fbc: input.fbc,
        source_url: input.sourceUrl,
        client_ip: ip === "unknown" ? undefined : ip,
        user_agent: request.headers.get("user-agent") ?? undefined,
      },
    })
    .select("id, download_token")
    .single();
  if (error || !created) {
    // Two quick submits with the same email: return the one that won.
    const { data: again } = await admin.from("lead_responses").select("id, download_token").eq("magnet_id", magnet.id).ilike("email", email).maybeSingle();
    if (again) return NextResponse.json({ responseId: again.id, token: again.download_token, repeat: true });
    console.error("[lead]", error?.message);
    return NextResponse.json({ error: "Couldn't save your details. Please try again." }, { status: 500 });
  }
  after(() => runLeadTasks(created.id));
  return NextResponse.json({ responseId: created.id, token: created.download_token });
}
