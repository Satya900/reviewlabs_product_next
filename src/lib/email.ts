import "server-only";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

export type EmailAttachment = { filename: string; content: string }; // content is base64

type Email = { to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[]; replyTo?: string };

export async function sendEmail(email: Email): Promise<void> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    const files = email.attachments?.map((a) => a.filename).join(", ");
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"${files ? ` attachments=${files}` : ""}\n${email.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    // Mail goes out from the no-reply sender; buyer replies land in the support inbox.
    body: JSON.stringify({
      from: env.emailFrom(),
      reply_to: email.replyTo ?? site.supportEmail,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.attachments?.length ? { attachments: email.attachments } : {}),
    }),
    // Attachments make the request bigger, so allow more time.
    signal: AbortSignal.timeout(email.attachments?.length ? 30000 : 10000),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

// A template stored in Resend (Dashboard > Templates), filled with variables.
// Resend renders the HTML and the subject saved with the template.
export async function sendTemplateEmail(email: { to: string; templateId: string; variables: Record<string, string>; replyTo?: string }): Promise<void> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    console.info(`[email:dev] to=${email.to} template=${email.templateId} variables=${JSON.stringify(email.variables)}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom(),
      reply_to: email.replyTo ?? site.supportEmail,
      to: [email.to],
      template: { id: email.templateId, variables: email.variables },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type BatchEmail = { from: string; to: string; subject: string; html: string; text: string; replyTo?: string; headers?: Record<string, string> };

// Up to 100 emails in one Resend call. Returns the ones that went out; if the
// batch is rejected, sends them one by one so one bad address can't block the rest.
export async function sendEmailBatch(emails: BatchEmail[]): Promise<{ sent: number[]; failed: { index: number; error: string }[] }> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    for (const e of emails) console.info(`[email:dev] batch to=${e.to} subject="${e.subject}"`);
    return { sent: emails.map((_, i) => i), failed: [] };
  }
  const toResend = (e: BatchEmail) => ({ from: e.from, to: [e.to], subject: e.subject, html: e.html, text: e.text, reply_to: e.replyTo ?? site.supportEmail, ...(e.headers ? { headers: e.headers } : {}) });
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(emails.map(toResend)),
    signal: AbortSignal.timeout(30000),
  });
  if (res.ok) return { sent: emails.map((_, i) => i), failed: [] };
  if (res.status === 429) throw new Error("Resend rate limit");
  const sent: number[] = [];
  const failed: { index: number; error: string }[] = [];
  for (const [i, e] of emails.entries()) {
    const one = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(toResend(e)),
      signal: AbortSignal.timeout(10000),
    });
    if (one.ok) sent.push(i);
    else failed.push({ index: i, error: `Resend ${one.status}: ${(await one.text()).slice(0, 200)}` });
  }
  return { sent, failed };
}
