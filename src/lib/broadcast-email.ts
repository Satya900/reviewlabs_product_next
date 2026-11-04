// The email a broadcast sends. Pure, so tests and the editor's preview use the
// same rendering. The creator writes plain text: blank lines start a new
// paragraph, and links are made clickable.

export const BROADCAST_MONTHLY_LIMIT = 5000;

export type BroadcastContent = {
  subject: string;
  body: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  creatorName: string;
};

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const escape = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Escaped text with https links turned into anchors.
function linkify(text: string): string {
  return escape(text).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (url) => `<a href="${url}" style="color:#0052ff;">${url}</a>`);
}

export function paragraphs(body: string): string[] {
  return body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export function renderBroadcast(c: BroadcastContent, unsubscribeUrl: string): { html: string; text: string } {
  const paras = paragraphs(c.body);
  const button = c.buttonLabel && c.buttonUrl
    ? `<p style="margin:24px 0 0 0;"><a href="${escape(c.buttonUrl)}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:100px;">${escape(c.buttonLabel)}</a></p>`
    : "";
  const footer = `You're getting this because you bought from or signed up with ${c.creatorName} on Reviewlabs.`;
  const html = `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  ${paras.map((p) => `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#0a0b0d;">${linkify(p).replace(/\n/g, "<br>")}</p>`).join("")}
  ${button}
</div>
<p style="max-width:560px;margin:16px auto 0 auto;font-family:${font};font-size:12px;line-height:1.5;color:#7c828a;text-align:center;">${escape(footer)} <a href="${escape(unsubscribeUrl)}" style="color:#7c828a;">Unsubscribe</a></p></div>`;
  const text = [...paras, c.buttonLabel && c.buttonUrl ? `${c.buttonLabel}: ${c.buttonUrl}` : "", `--\n${footer}\nUnsubscribe: ${unsubscribeUrl}`].filter(Boolean).join("\n\n");
  return { html, text };
}

// "Satya via Reviewlabs <no-reply@reviewlabs.space>" from the platform sender.
export function broadcastFrom(creatorName: string, platformFrom: string): string {
  const address = platformFrom.match(/<([^>]+)>/)?.[1] ?? platformFrom.trim();
  const name = creatorName.replace(/["<>\r\n]/g, "").trim().slice(0, 60) || "A creator";
  return `"${name} via Reviewlabs" <${address}>`;
}
