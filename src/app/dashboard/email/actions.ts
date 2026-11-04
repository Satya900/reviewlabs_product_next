"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requirePlan } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { hasProPlan } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { processBroadcasts } from "@/lib/broadcasts";
import { BROADCAST_MONTHLY_LIMIT, renderBroadcast } from "@/lib/broadcast-email";

export type ActionState = { error?: string; ok?: string } | null;
const KINDS = ["all", "buyers", "leads", "page", "magnet"] as const;

function read(formData: FormData) {
  const text = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const kind = text("audience", 10) as (typeof KINDS)[number];
  const ref = text("audience_ref", 40);
  return {
    subject: text("subject", 150),
    body: String(formData.get("body") ?? "").trim().slice(0, 10000),
    buttonLabel: text("button_label", 40),
    buttonUrl: text("button_url", 2000),
    kind: KINDS.includes(kind) ? kind : "all",
    ref: /^[0-9a-f-]{36}$/.test(ref) ? ref : null,
  };
}

function check(v: ReturnType<typeof read>): string | null {
  if (!v.subject) return "Add a subject.";
  if (!v.body) return "Write your message.";
  if (v.buttonLabel && !v.buttonUrl) return "Add the link for your button, or remove the button text.";
  if (v.buttonUrl && !/^https:\/\/[^\s]+$/.test(v.buttonUrl)) return "The button link must start with https://";
  if ((v.kind === "page" || v.kind === "magnet") && !v.ref) return "Choose which product or lead magnet.";
  return null;
}

// A preview to the creator's own inbox. Doesn't count towards the allowance.
export async function sendTestBroadcast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) return { error: "Email broadcasts are part of Pro." };
  const v = read(formData);
  const problem = check(v);
  if (problem) return { error: problem };
  if (!(await rateLimit(`broadcast-test:${profile.id}`, 10, 3600))) return { error: "That's a lot of tests. Try again in an hour." };
  const name = profile.name?.trim() || "A creator";
  const { html, text } = renderBroadcast({ subject: v.subject, body: v.body, buttonLabel: v.buttonLabel, buttonUrl: v.buttonUrl, creatorName: name }, `${env.appUrl()}/dashboard/email`);
  try {
    await sendEmail({ to: profile.email, subject: `[Test] ${v.subject}`, html, text, replyTo: profile.email });
  } catch {
    return { error: "Couldn't send the test. Please try again." };
  }
  return { ok: `Test sent to ${profile.email}.` };
}

// Creates the broadcast with its recipient list and starts sending.
export async function sendBroadcast(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) return { error: "Email broadcasts are part of Pro. Upgrade in Plan and billing." };
  if (!profile.email_verified_at && !profile.is_admin) return { error: "Verify your email address before sending broadcasts." };
  const v = read(formData);
  const problem = check(v);
  if (problem) return { error: problem };
  if (!(await rateLimit(`broadcast-send:${profile.id}`, 10, 86400))) return { error: "You've sent a lot of broadcasts today. Try again tomorrow." };

  const { data, error } = await createAdminClient()
    .rpc("create_broadcast", {
      p_creator_id: profile.id, p_subject: v.subject, p_body: v.body, p_button_label: v.buttonLabel, p_button_url: v.buttonUrl,
      p_kind: v.kind, p_ref: v.ref, p_monthly_limit: BROADCAST_MONTHLY_LIMIT,
    })
    .single<{ broadcast_id: string | null; recipients: number; used: number }>();
  if (error || !data) return { error: "Couldn't send right now. Please try again." };
  if (!data.recipients) return { error: "Nobody to send to yet: no subscribers match this audience." };
  if (!data.broadcast_id) {
    return { error: `This goes to ${data.recipients.toLocaleString("en-IN")} people, but you have ${Math.max(0, BROADCAST_MONTHLY_LIMIT - data.used).toLocaleString("en-IN")} of your ${BROADCAST_MONTHLY_LIMIT.toLocaleString("en-IN")} emails left this month. Pick a smaller audience.` };
  }
  after(() => processBroadcasts(25_000).catch((e) => console.error("[broadcasts]", e)));
  redirect(`/dashboard/email?sent=${data.broadcast_id}`);
}

// How many people an audience reaches right now (for the composer).
export async function audienceSize(kind: string, ref: string | null): Promise<number> {
  const profile = await requirePlan();
  if (!hasProPlan(profile) || !KINDS.includes(kind as (typeof KINDS)[number])) return 0;
  const { data } = await createAdminClient().rpc("broadcast_audience", { p_creator_id: profile.id, p_kind: kind, p_ref: ref && /^[0-9a-f-]{36}$/.test(ref) ? ref : null });
  return (data ?? []).length;
}
