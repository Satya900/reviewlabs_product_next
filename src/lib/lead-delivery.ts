import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { attachIfSmall, formatSize } from "@/lib/fulfilment";
import { sendLeadResponseEvent } from "@/lib/meta";
import { sha256 } from "@/lib/crypto";
import type { Tracking } from "@/lib/types";

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

type Response = { id: string; magnet_id: string; creator_id: string; name: string; email: string; phone: string; download_token: string; tracking: Tracking | null };

// After a new response: send the free files by email and report a Lead to Meta.
export async function runLeadTasks(responseId: string) {
  const admin = createAdminClient();
  const { data: response } = await admin.from("lead_responses").select("*").eq("id", responseId).single<Response>();
  if (!response) return;
  const { data: magnet } = await admin.from("lead_magnets").select("title, thank_you_message").eq("id", response.magnet_id).single();
  if (!magnet) return;
  const results = await Promise.allSettled([sendLeadEmail(response, magnet.title, magnet.thank_you_message), sendLeadResponseEvent(response, magnet.title)]);
  for (const r of results) if (r.status === "rejected") console.error(`[lead] response ${responseId}:`, r.reason);
}

export function leadFileUrl(token: string, fileId: string) {
  return `${env.appUrl()}/api/leads/download/${token}/${fileId}`;
}

async function sendLeadEmail(response: Response, title: string, thankYou: string) {
  const admin = createAdminClient();
  const { data: files } = await admin
    .from("lead_magnet_files")
    .select("id, file_name, size_bytes, storage_path")
    .eq("magnet_id", response.magnet_id)
    .order("created_at");
  if (!files?.length) return; // nothing to deliver

  // Claim first so a retry never sends twice.
  const { data: claimed } = await admin
    .from("lead_responses")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", response.id)
    .is("email_sent_at", null)
    .select("id");
  if (!claimed?.length) return;

  const { data: seller } = await admin.from("profiles").select("name").eq("id", response.creator_id).maybeSingle();
  const from = seller?.name || "the creator";
  try {
    const attachments = await attachIfSmall(files);
    const rows = files
      .map(
        (f) => `<tr>
          <td style="padding:14px 0;border-bottom:1px solid #eef0f3;font-family:${font};font-size:15px;color:#0a0b0d;word-break:break-all;">${escapeHtml(f.file_name)}<br><span style="font-size:12px;color:#7c828a;">${formatSize(f.size_bytes)}</span></td>
          <td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #eef0f3;white-space:nowrap;"><a href="${leadFileUrl(response.download_token, f.id)}" style="display:inline-block;background:#0052ff;color:#ffffff;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:100px;">Download</a></td>
        </tr>`,
      )
      .join("");
    const html = `<div style="background:#f7f7f7;padding:32px 12px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
    <p style="margin:0;font-size:14px;color:#7c828a;">${escapeHtml(from)} via Reviewlabs</p>
    <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">Here's your free resource</h1>
    <p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(response.name)}, here's <b style="color:#0a0b0d;">${escapeHtml(title)}</b>.${attachments.length ? " The files are attached to this email too." : ""}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #eef0f3;">${rows}</table>
    ${thankYou ? `<p style="margin:20px 0 0 0;padding:16px;background:#f7f7f7;border-radius:16px;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(thankYou)}</p>` : ""}
    <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#7c828a;">Your links never expire. Keep this email so you can download again any time.</p>
    <p style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #eef0f3;font-size:12px;line-height:1.6;color:#a8acb3;">You're getting this because you asked for it on ${escapeHtml(from)}'s page.</p>
  </div>
</div>`;
    const text = [
      "Here's your free resource",
      `${response.name}, here's "${title}".${attachments.length ? " The files are attached to this email too." : ""}`,
      ...files.map((f) => `${f.file_name} (${formatSize(f.size_bytes)}): ${leadFileUrl(response.download_token, f.id)}`),
      thankYou,
      "Your links never expire.",
    ].filter(Boolean).join("\n\n");
    await sendEmail({ to: response.email, subject: `Your free download: ${title}`, html, text, attachments });
  } catch (e) {
    await admin.from("lead_responses").update({ email_sent_at: null }).eq("id", response.id);
    throw e;
  }
}

export function codeHash(magnetId: string, email: string, code: string) {
  return sha256(`${magnetId}:${email.toLowerCase()}:${code}`);
}

export async function sendLeadCodeEmail(email: string, code: string, title: string) {
  await sendEmail({
    to: email,
    subject: `${code} is your verification code`,
    html: `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
      <p style="margin:0;font-size:15px;color:#5b616e;">Your code for <b style="color:#0a0b0d;">${escapeHtml(title)}</b></p>
      <p style="margin:16px 0;font-size:36px;letter-spacing:8px;font-weight:600;">${code}</p>
      <p style="margin:0;font-size:13px;color:#7c828a;">It works for 10 minutes. If you didn't ask for this, you can ignore this email.</p></div></div>`,
    text: `Your code for "${title}" is ${code}. It works for 10 minutes.`,
  });
}
