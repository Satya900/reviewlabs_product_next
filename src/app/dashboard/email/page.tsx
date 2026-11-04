import Link from "next/link";
import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProPlan } from "@/lib/plans";
import { BROADCAST_MONTHLY_LIMIT } from "@/lib/broadcast-email";
import { UpgradeCard } from "@/components/upgrade-card";
import { Badge, EmptyState, Notice, PageTitle, Stat, buttonClass, tableClass } from "@/components/ui";

export const metadata = { title: "Email" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function monthStartIst(): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 5.5 * 3600_000).toISOString();
}

export default async function EmailPage({ searchParams }: PageProps<"/dashboard/email">) {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) {
    return (
      <>
        <PageTitle sub="Email everyone who bought from you or signed up for a freebie.">Email</PageTitle>
        <UpgradeCard feature="email" />
      </>
    );
  }
  const { sent } = await searchParams;
  const supabase = await createClient();
  const [{ data: broadcasts }, { count: usedThisMonth }, { data: audience }, { count: unsubscribed }] = await Promise.all([
    supabase.from("broadcasts").select("id, subject, status, recipient_count, sent_count, failed_count, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("broadcast_recipients").select("id", { count: "exact", head: true }).gte("created_at", monthStartIst()).neq("status", "skipped"),
    createAdminClient().rpc("broadcast_audience", { p_creator_id: profile.id, p_kind: "all", p_ref: null }),
    supabase.from("email_unsubscribes").select("email", { count: "exact", head: true }),
  ]);
  const used = usedThisMonth ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub="Email everyone who bought from you (and ticked “send me updates”) or signed up for a freebie.">Email</PageTitle>
        <Link href="/dashboard/email/new" className={buttonClass.primary}>New email</Link>
      </div>
      {typeof sent === "string" && <Notice tone="good">Your email is on its way. Big lists go out over a few hours; you can watch the progress below.</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Subscribers" value={(audience ?? []).length.toLocaleString("en-IN")} sub="Opted-in buyers and lead magnet sign-ups" />
        <Stat label="Emails this month" value={`${used.toLocaleString("en-IN")} / ${BROADCAST_MONTHLY_LIMIT.toLocaleString("en-IN")}`} sub="Resets on the 1st" />
        <Stat label="Unsubscribed" value={(unsubscribed ?? 0).toLocaleString("en-IN")} />
      </div>

      {!broadcasts?.length ? (
        <EmptyState>No emails yet. Write your first one to tell your subscribers about a new product or a launch offer.</EmptyState>
      ) : (
        <div className={tableClass.wrap}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Subject</th>
                <th className={tableClass.th}>Status</th>
                <th className={`${tableClass.th} text-right`}>Sent</th>
                <th className={tableClass.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td className={tableClass.td}>{b.subject}</td>
                  <td className={tableClass.td}><Badge status={b.status === "sent" ? "live" : b.status === "failed" ? "failed" : "pending"} label={b.status === "sending" ? "Sending" : b.status === "sent" ? "Sent" : "Failed"} /></td>
                  <td className={`${tableClass.td} num text-right`}>
                    {b.sent_count.toLocaleString("en-IN")} / {b.recipient_count.toLocaleString("en-IN")}
                    {b.failed_count > 0 && <span className="block text-[12px] text-down">{b.failed_count} failed</span>}
                  </td>
                  <td className={tableClass.td}>{dateFmt.format(new Date(b.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-muted">Emails come from “{profile.name?.trim() || "Your name"} via Reviewlabs”, and replies go to {profile.email}. Every email has an unsubscribe link.</p>
    </>
  );
}
