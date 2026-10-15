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

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
