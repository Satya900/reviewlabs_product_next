import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendEmailBatch, type BatchEmail } from "@/lib/email";
import { broadcastFrom, renderBroadcast } from "@/lib/broadcast-email";

// Sends queued broadcast emails in batches, oldest broadcast first, without
// going over the platform's daily cap (the rest waits for the next run).
// Runs right after a broadcast is created and from the reconcile job.

const BATCH = 50;

type Claimed = { id: string; broadcast_id: string; creator_id: string; email: string; name: string; token: string };
type Broadcast = { id: string; subject: string; body: string; button_label: string | null; button_url: string | null; creator_id: string };

function istDayStart(): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600_000).toISOString();
}

export async function processBroadcasts(budgetMs = 20_000): Promise<{ sent: number; failed: number; capped: boolean }> {
  const db = createAdminClient();
  const deadline = Date.now() + budgetMs;
  const cap = env.broadcastDailyCap();
  let sent = 0, failed = 0, capped = false;
  const touched = new Set<string>();
  const broadcasts = new Map<string, Broadcast & { from: string; replyTo: string; creatorName: string }>();

  while (Date.now() < deadline) {
    const { count: today } = await db.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", istDayStart());
    const room = cap - (today ?? 0);
    if (room <= 0) { capped = true; break; }
    const { data: claimed, error } = await db.rpc("claim_broadcast_recipients", { p_limit: Math.min(BATCH, room) });
    if (error) throw new Error(`claim recipients: ${error.message}`);
    const rows = (claimed ?? []) as Claimed[];
    if (!rows.length) break;

    // Broadcast content and the creator's name, once per broadcast.
    for (const id of new Set(rows.map((r) => r.broadcast_id))) {
      if (broadcasts.has(id)) continue;
      const { data: b } = await db.from("broadcasts").select("id, subject, body, button_label, button_url, creator_id").eq("id", id).single<Broadcast>();
      const { data: p } = await db.from("profiles").select("name, email").eq("id", b!.creator_id).single();
      const creatorName = (p?.name as string | null)?.trim() || "A creator";
      broadcasts.set(id, { ...b!, creatorName, from: broadcastFrom(creatorName, env.emailFrom()), replyTo: p?.email as string });
    }

    const emails: BatchEmail[] = rows.map((r) => {
      const b = broadcasts.get(r.broadcast_id)!;
      const unsubscribe = `${env.appUrl()}/u/${r.token}`;
      const { html, text } = renderBroadcast({ subject: b.subject, body: b.body, buttonLabel: b.button_label, buttonUrl: b.button_url, creatorName: b.creatorName }, unsubscribe);
      return {
        from: b.from, to: r.email, subject: b.subject, html, text, replyTo: b.replyTo,
        headers: { "List-Unsubscribe": `<${env.appUrl()}/api/unsubscribe/${r.token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });

    let result: Awaited<ReturnType<typeof sendEmailBatch>>;
    try {
      result = await sendEmailBatch(emails);
    } catch (e) {
      // Rate limited or Resend down: put them back for the next run.
      await db.from("broadcast_recipients").update({ status: "pending", claimed_at: null }).in("id", rows.map((r) => r.id));
      console.error("[broadcasts] send:", (e as Error).message);
      break;
    }
    const now = new Date().toISOString();
    const okIds = result.sent.map((i) => rows[i].id);
    if (okIds.length) await db.from("broadcast_recipients").update({ status: "sent", sent_at: now }).in("id", okIds);
    for (const f of result.failed) await db.from("broadcast_recipients").update({ status: "failed", error: f.error }).eq("id", rows[f.index].id);
    sent += okIds.length;
    failed += result.failed.length;
    rows.forEach((r) => touched.add(r.broadcast_id));
  }

  for (const id of touched) await db.rpc("refresh_broadcast", { p_broadcast_id: id });
  return { sent, failed, capped };
}

// Unsubscribes the email behind a broadcast link from that creator's emails.
export async function unsubscribeByToken(token: string): Promise<{ creatorName: string; email: string } | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const db = createAdminClient();
  const { data: r } = await db.from("broadcast_recipients").select("creator_id, email").eq("token", token).maybeSingle();
  if (!r) return null;
  await db.from("email_unsubscribes").upsert({ creator_id: r.creator_id, email: r.email }, { onConflict: "creator_id,email", ignoreDuplicates: true });
  const { data: p } = await db.from("profiles").select("name").eq("id", r.creator_id).single();
  return { creatorName: (p?.name as string | null)?.trim() || "this creator", email: r.email };
}

// Who a link belongs to, without unsubscribing (for the confirm page).
export async function recipientByToken(token: string): Promise<{ creatorName: string; email: string; unsubscribed: boolean } | null> {
  if (!/^[0-9a-f]{36}$/.test(token)) return null;
  const db = createAdminClient();
  const { data: r } = await db.from("broadcast_recipients").select("creator_id, email").eq("token", token).maybeSingle();
  if (!r) return null;
  const [{ data: p }, { data: u }] = await Promise.all([
    db.from("profiles").select("name").eq("id", r.creator_id).single(),
    db.from("email_unsubscribes").select("email").eq("creator_id", r.creator_id).eq("email", r.email).maybeSingle(),
  ]);
  return { creatorName: (p?.name as string | null)?.trim() || "this creator", email: r.email, unsubscribed: !!u };
}
