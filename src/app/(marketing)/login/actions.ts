"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export type LoginState = { error?: string; sentTo?: string } | null;

const schema = z.object({
  email: z.email("Enter a valid email").max(200),
  next: z.string().max(200).optional(),
});

export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const email = parsed.data.email.toLowerCase();
  const next = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";

  const h = await headers();
  const ipOk = await rateLimit(`login:ip:${clientIp(h) ?? "unknown"}`, 10, 600);
  const emailOk = await rateLimit(`login:email:${email}`, 4, 600);
  if (!ipOk || !emailOk) return tooManyRequests;

  // Creator accounts are invite-only. The database enforces this too.
  const admin = createAdminClient();
  const [{ data: invite }, { data: profile }] = await Promise.all([
    admin.from("creator_invites").select("email").eq("email", email).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
  ]);
  if (!invite && !profile) {
    return { error: "This email doesn't have a creator account. Accounts are invite-only for now, so get in touch with us to join." };
  }

  const origin = h.get("origin") ?? env.appUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error("[login]", error.message);
    if (/rate limit/i.test(error.message)) {
      return { error: "Too many sign-in emails have gone out in the last hour. Please try again in a little while." };
    }
    if (/after \d+ seconds?/i.test(error.message)) {
      return { error: "Please wait a few seconds before asking for another link." };
    }
    return { error: "We couldn't send the link right now. Try again in a minute." };
  }
  return { sentTo: email };
}
