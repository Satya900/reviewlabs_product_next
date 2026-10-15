"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/email";
import { site } from "@/lib/site";

export type RequestState = { error?: string; sent?: boolean } | null;

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email").max(200).transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(30),
  business: z.string().trim().max(160),
  website: z.string().trim().max(300),
  monthly_volume: z.string().trim().max(60),
  requirements: z.string().trim().min(10, "Tell us a little more about what you need").max(3000),
  company: z.string().max(0).optional(), // honeypot: real people leave this empty
});

export async function submitCustomRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Bots that fill the hidden field get a quiet "success".
    if (parsed.error.issues.some((i) => i.path[0] === "company")) return { sent: true };
    return { error: parsed.error.issues[0]?.message };
  }
  const input = parsed.data;
  const ip = clientIp(await headers()) ?? "unknown";
  if (!(await rateLimit(`custom-request:${ip}`, 3, 3600))) return tooManyRequests;

  const { error } = await createAdminClient().from("custom_requests").insert({
    name: input.name,
    email: input.email,
    phone: input.phone,
    business: input.business,
    website: input.website,
    monthly_volume: input.monthly_volume,
    requirements: input.requirements,
  });
  if (error) {
    console.error("[custom-request]", error.message);
    return { error: "We couldn't send your request right now. Please email us instead." };
  }

  const rows: [string, string][] = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone || "-"],
    ["Business", input.business || "-"],
    ["Website / social", input.website || "-"],
    ["Monthly sales", input.monthly_volume || "-"],
  ];
  try {
    await sendEmail({
      to: site.supportEmail,
      replyTo: input.email,
      subject: `Custom plan request from ${input.name}${input.business ? ` (${input.business})` : ""}`,
      html: `<div style="font-family:-apple-system,system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0a0b0d">
        <h2 style="font-weight:600;margin:0 0 12px">New custom plan request</h2>
        <table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7c828a">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`).join("")}</table>
        <p style="margin:16px 0 4px;color:#7c828a">Requirements</p>
        <p style="margin:0;white-space:pre-wrap">${escapeHtml(input.requirements)}</p>
        <p style="margin-top:20px;color:#7c828a;font-size:13px">Reply to this email to contact them directly. All requests are also in Admin → Requests.</p>
      </div>`,
      text: [...rows.map(([k, v]) => `${k}: ${v}`), "", "Requirements:", input.requirements].join("\n"),
    });
  } catch (e) {
    // Saved already; the admin list still shows it.
    console.error("[custom-request] email", e);
  }
  return { sent: true };
}
