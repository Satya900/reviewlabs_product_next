import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatPaise } from "@/lib/money";
import { sendPurchaseEvent } from "@/lib/meta";
import type { RazorpayPayment } from "@/lib/razorpay";
import type { Order } from "@/lib/types";
import { orderFiles, orderLinks, type DeliverableLink } from "@/lib/order-files";

// Records a captured Razorpay payment. Idempotent; safe from verify, webhook and cron.
export async function recordCapturedPayment(payment: RazorpayPayment) {
  const { data, error } = await createAdminClient()
    .rpc("mark_order_paid", {
      p_razorpay_order_id: payment.order_id,
      p_razorpay_payment_id: payment.id,
      p_amount_paise: payment.amount,
      p_fee_paise: payment.fee ?? 0,
      p_tax_paise: payment.tax ?? 0,
      p_method: payment.method,
      p_raw: payment,
      p_grant_ttl: env.downloadTtlDays() ? `${env.downloadTtlDays()} days` : null,
      p_max_downloads: env.downloadMaxPerGrant(),
    })
    .maybeSingle<{ order_id: string; newly_paid: boolean }>();
  if (error) throw new Error(`mark_order_paid failed: ${error.message}`);
  return data; // null when the Razorpay order isn't one of ours
}

// Receipt email + Meta Purchase. Each step is idempotent and retried by cron.
export async function runPostPaymentTasks(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single<Order>();
  if (!order || order.status !== "paid") return;

  const results = await Promise.allSettled([sendReceipt(order), sendPurchaseEvent(order)]);
  for (const r of results) {
    if (r.status === "rejected") console.error(`[post-payment] order ${orderId}:`, r.reason);
  }
}

// Files up to this total size are attached to the email as well as linked.
// Larger files get download buttons only, so the email never bounces.
const ATTACH_LIMIT_BYTES = 10 * 1024 * 1024;

type DeliveryFile = { id: string; file_name: string; size_bytes: number; storage_path: string };

async function sendReceipt(order: Order) {
  const admin = createAdminClient();
  // Claim the email first so concurrent callers never send it twice.
  const { data: claimed } = await admin
    .from("orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("receipt_sent_at", null)
    .select("id");
  if (!claimed?.length) return;

  try {
    const [{ data: grant }, list, links, { data: page }] = await Promise.all([
      admin.from("download_grants").select("token").eq("order_id", order.id).single(),
      orderFiles(order),
      orderLinks(order),
      admin.from("payment_pages").select("thank_you_message, support_email").eq("id", order.page_id).maybeSingle(),
    ]);
    const attachments = await attachIfSmall(list);
    await sendEmail({
      ...deliveryEmail(order, list, links, grant?.token ?? null, attachments.length > 0, page?.thank_you_message ?? null),
      attachments,
      // Buyer replies reach the seller when the page has its own support email.
      replyTo: page?.support_email ?? undefined,
    });
  } catch (e) {
    await admin.from("orders").update({ receipt_sent_at: null }).eq("id", order.id);
    throw e;
  }
}

export async function attachIfSmall(files: DeliveryFile[]) {
  const total = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  if (!files.length || total > ATTACH_LIMIT_BYTES) return [];
  const storage = createAdminClient().storage.from("product-files");
  try {
    return await Promise.all(
      files.map(async (f) => {
        const { data, error } = await storage.download(f.storage_path);
        if (error || !data) throw new Error(error?.message ?? "download failed");
        return { filename: f.file_name, content: Buffer.from(await data.arrayBuffer()).toString("base64") };
      }),
    );
  } catch (e) {
    // The download links still work, so send the email without attachments.
    console.error("[delivery] attaching files failed:", (e as Error).message);
    return [];
  }
}

function accessNote(): string {
  const ttl = env.downloadTtlDays();
  return ttl
    ? `These links work for ${ttl} days. If they expire, request new ones from the downloads page.`
    : "Your links never expire. Keep this email so you can download again any time.";
}

export function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function deliveryEmail(order: Order, files: DeliveryFile[], links: DeliverableLink[], token: string | null, attached: boolean, thankYou: string | null) {
  const title = escapeHtml(order.page_title);
  const base = env.appUrl();
  const fileUrl = (f: DeliveryFile) => `${base}/api/download/${token}/${f.id}`;
  const downloadsPage = token ? `${base}/d/${token}` : null;
  const hasFiles = files.length > 0 && token;

  const fileRows = hasFiles
    ? files
        .map(
          (f) => `<tr>
            <td style="padding:14px 0;border-bottom:1px solid #eef0f3;font-family:${font};font-size:15px;color:#0a0b0d;word-break:break-all;">${escapeHtml(f.file_name)}<br><span style="font-size:12px;color:#7c828a;">${formatSize(f.size_bytes)}</span></td>
            <td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #eef0f3;white-space:nowrap;"><a href="${fileUrl(f)}" style="display:inline-block;background:#0052ff;color:#ffffff;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:100px;">Download</a></td>
          </tr>`,
        )
        .join("")
    : "";

  const linkRows = links
    .map(
      (l) => `<tr>
            <td style="padding:14px 0;border-bottom:1px solid #eef0f3;font-family:${font};font-size:15px;color:#0a0b0d;word-break:break-word;">${escapeHtml(l.label)}</td>
            <td align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #eef0f3;white-space:nowrap;"><a href="${escapeHtml(l.url)}" style="display:inline-block;background:#0052ff;color:#ffffff;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:100px;">Open</a></td>
          </tr>`,
    )
    .join("");
  const hasLinks = links.length > 0;

  const paid = `${formatPaise(order.amount_paise)}${order.coupon_code ? `, coupon ${escapeHtml(order.coupon_code)}` : ""}`;

  const html = `<div style="background:#f7f7f7;padding:32px 12px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
    <p style="margin:0;font-size:14px;color:#7c828a;">Reviewlabs</p>
    <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">${hasFiles && hasLinks ? "Here's your purchase" : hasFiles ? "Here are your files" : hasLinks ? "Here are your links" : "Thanks for your purchase"}</h1>
    <p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(order.buyer_name)}, thanks for buying <b style="color:#0a0b0d;">${title}</b>${order.offer_title ? ` and <b style="color:#0a0b0d;">${escapeHtml(order.offer_title)}</b>` : ""}.${attached ? " The files are attached to this email too." : ""}</p>
    ${hasFiles ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #eef0f3;">${fileRows}</table>` : ""}
    ${hasLinks ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #eef0f3;">${linkRows}</table>` : ""}
    ${downloadsPage && (hasFiles || hasLinks) ? `<p style="margin:16px 0 0 0;font-size:14px;"><a href="${downloadsPage}" style="color:#0052ff;font-weight:600;text-decoration:none;">Open your downloads page</a></p>` : ""}
    ${thankYou ? `<p style="margin:20px 0 0 0;padding:16px;background:#f7f7f7;border-radius:16px;font-size:15px;line-height:1.5;color:#0a0b0d;white-space:pre-wrap;">${escapeHtml(thankYou)}</p>` : ""}
    ${hasFiles ? `<p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#7c828a;">${accessNote()}</p>` : ""}
    <p style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #eef0f3;font-size:12px;line-height:1.6;color:#a8acb3;">Paid ${paid} · Order ${order.id}<br>Need help? Just reply to this email.</p>
  </div>
</div>`;

  const text = [
    hasFiles && hasLinks ? "Here's your purchase" : hasFiles ? "Here are your files" : hasLinks ? "Here are your links" : "Thanks for your purchase",
    `${order.buyer_name}, thanks for buying "${order.page_title}"${order.offer_title ? ` and "${order.offer_title}"` : ""}.${attached ? " The files are attached to this email too." : ""}`,
    ...(hasFiles ? files.map((f) => `${f.file_name} (${formatSize(f.size_bytes)}): ${fileUrl(f)}`) : []),
    ...links.map((l) => `${l.label}: ${l.url}`),
    downloadsPage && (hasFiles || hasLinks) ? `All your downloads: ${downloadsPage}` : "",
    thankYou ?? "",
    hasFiles ? accessNote() : "",
    `Paid ${formatPaise(order.amount_paise)} · Order ${order.id}`,
    "Need help? Just reply to this email.",
  ].filter(Boolean).join("\n\n");

  return {
    to: order.buyer_email,
    subject: hasFiles || hasLinks ? `Your purchase: ${order.page_title}` : `Thanks for buying ${order.page_title}`,
    html,
    text,
  };
}

export function downloadLinksEmail(email: string, items: { title: string; url: string }[]) {
  return {
    to: email,
    subject: "Your download links",
    html: `<div style="font-family:-apple-system,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;max-width:520px;margin:auto;color:#0a0b0d;padding:32px;border:1px solid #dee1e6;border-radius:24px">
      <h2 style="font-weight:400;font-size:28px;letter-spacing:-0.5px;margin:0 0 12px">Your download links</h2>
      <ul>${items.map((i) => `<li><a href="${i.url}">${escapeHtml(i.title)}</a></li>`).join("")}</ul>
      <p style="font-size:13px;color:#7c828a">${accessNote()}</p></div>`,
    text: `Your download links:\n${items.map((i) => `${i.title}: ${i.url}`).join("\n")}\n${accessNote()}`,
  };
}
