import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { priceLabel } from "@/lib/plans";

// Two emails around the end of the free trial, sent by the reconcile job:
// a reminder 2 days before, and a note when it ends and the store goes offline.
// Each is claimed first (a timestamp on the profile), so it's sent once.

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function render(title: string, lines: string[], cta: string, link: string) {
  return `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  <p style="margin:0;font-size:14px;color:#7c828a;">Reviewlabs</p>
  <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">${escapeHtml(title)}</h1>
  ${lines.map((l) => `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(l)}</p>`).join("")}
  <p style="margin:24px 0 0 0;"><a href="${link}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:100px;">${escapeHtml(cta)}</a></p>
</div></div>`;
}

type Creator = { id: string; email: string; name: string | null };

async function claim(id: string, column: "trial_reminder_sent_at" | "trial_ended_email_at"): Promise<boolean> {
  const { data } = await createAdminClient().from("profiles").update({ [column]: new Date().toISOString() }).eq("id", id).is(column, null).select("id");
  return !!data?.length;
}

async function release(id: string, column: "trial_reminder_sent_at" | "trial_ended_email_at") {
  await createAdminClient().from("profiles").update({ [column]: null }).eq("id", id);
}

async function sendReminder(c: Creator) {
  const link = `${env.appUrl()}/dashboard/billing`;
  const hello = c.name ? `Hi ${c.name.split(" ")[0]},` : "Hi,";
  const lines = [
    hello,
    "Your Reviewlabs free trial ends in 2 days. After that your product pages, storefront and lead magnets stop taking buyers until you choose a plan.",
    `Creator is ${priceLabel("creator", "month")}/month and Pro, with AutoDM, is ${priceLabel("pro", "month")}/month. Both have 0% platform fee on sales. If you choose now, billing only starts when the trial ends.`,
  ];
  await sendEmail({ to: c.email, subject: "Your Reviewlabs trial ends in 2 days", html: render("Your trial ends in 2 days", lines, "Choose a plan", link), text: [...lines, `Choose a plan: ${link}`].join("\n\n") });
}

async function sendEnded(c: Creator) {
  const link = `${env.appUrl()}/dashboard/billing`;
  const hello = c.name ? `Hi ${c.name.split(" ")[0]},` : "Hi,";
  const lines = [
    hello,
    "Your Reviewlabs free trial has ended, so your store is now offline: buyers can't open your pages, storefront or lead magnets.",
    "Nothing has been deleted. Choose a plan and everything is back online straight away, exactly as you left it.",
  ];
  await sendEmail({ to: c.email, subject: "Your Reviewlabs store is offline", html: render("Your store is offline", lines, "Choose a plan", link), text: [...lines, `Choose a plan: ${link}`].join("\n\n") });
}

// Trials ending within 2 days, and trials that have ended without a plan.
export async function sendTrialEmails(): Promise<{ reminders: number; ended: number }> {
  const db = createAdminClient();
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const [{ data: ending }, { data: ended }] = await Promise.all([
    db.from("profiles").select("id, email, name").eq("is_admin", false).eq("plan", "free").is("trial_reminder_sent_at", null)
      .gt("trial_ends_at", now.toISOString()).lte("trial_ends_at", inTwoDays).limit(100),
    db.from("profiles").select("id, email, name").eq("is_admin", false).eq("plan", "free").is("trial_ended_email_at", null)
      .lte("trial_ends_at", now.toISOString()).gt("trial_ends_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()).limit(100),
  ]);

  let reminders = 0, endedCount = 0;
  for (const c of (ending ?? []) as Creator[]) {
    if (!(await claim(c.id, "trial_reminder_sent_at"))) continue;
    try {
      await sendReminder(c);
      reminders++;
    } catch (e) {
      await release(c.id, "trial_reminder_sent_at");
      console.error(`[trial] reminder to ${c.id}:`, (e as Error).message);
    }
  }
  for (const c of (ended ?? []) as Creator[]) {
    if (!(await claim(c.id, "trial_ended_email_at"))) continue;
    try {
      await sendEnded(c);
      endedCount++;
    } catch (e) {
      await release(c.id, "trial_ended_email_at");
      console.error(`[trial] ended email to ${c.id}:`, (e as Error).message);
    }
  }
  return { reminders, ended: endedCount };
}
