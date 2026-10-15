import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { codeHash, sendLeadCodeEmail } from "@/lib/lead-delivery";

const schema = z.object({ magnetId: z.uuid(), email: z.email("Enter a valid email").max(200) });

// Sends a 6-digit code for lead magnets that verify email.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { magnetId } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(request.headers) ?? "unknown";
  if (!(await rateLimit(`leadcode:ip:${ip}`, 10, 900)) || !(await rateLimit(`leadcode:email:${email}`, 4, 3600))) {
    return NextResponse.json(tooManyRequests, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: magnet } = await admin.from("lead_magnets").select("id, title, verify_email").eq("id", magnetId).eq("status", "live").maybeSingle();
  if (!magnet?.verify_email) return NextResponse.json({ error: "This form isn't available" }, { status: 404 });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await admin.from("lead_email_codes").delete().eq("magnet_id", magnetId).ilike("email", email);
  const { error } = await admin.from("lead_email_codes").insert({
    magnet_id: magnetId,
    email,
    code_hash: codeHash(magnetId, email, code),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "Couldn't send the code. Please try again." }, { status: 500 });
  try {
    await sendLeadCodeEmail(email, code, magnet.title);
  } catch (e) {
    console.error("[leadcode]", (e as Error).message);
    return NextResponse.json({ error: "Couldn't send the code to that email. Check it and try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
