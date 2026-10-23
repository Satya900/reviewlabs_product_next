import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, Panel, Stat } from "@/components/ui";
import { LedgerTable } from "@/components/ledger-table";
import type { LedgerEntry, Payout } from "@/lib/types";
import { AdjustmentForm, EmailVerificationControls, FeeForm, PausePayoutsButton, PayNowForm, PayoutForm, PlanForm } from "../../forms";
import { PayoutsTable } from "@/components/payouts-table";
import { destinationFor, payoutsEnabled } from "@/lib/payouts";
import { feePercentFor } from "@/lib/plans";
import { hasCreatorPlan } from "@/lib/plans";
import { Badge } from "@/components/ui";
import { chequeUrl } from "@/lib/payout-requests";

export default async function AdminCreator({ params }: PageProps<"/admin/creators/[id]">) {
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: p }, { data: balance }, { data: entries }, { data: payouts }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("creator_balances").select("*").eq("creator_id", id).maybeSingle(),
    db.from("ledger_entries").select("*").eq("creator_id", id).order("created_at", { ascending: false }).limit(300),
    db.from("payouts").select("*").eq("creator_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!p) notFound();
  const cheque = await chequeUrl(p.payout_cheque_path);
  const owed = Number(balance?.balance_paise ?? 0);
  const available = Number(balance?.available_paise ?? 0);
  const destination = destinationFor(p);

  return (
    <>
      <div className="space-y-1">
        <Link href="/admin" className="link text-[14px]">← Back to creators</Link>
        <PageTitle sub={p.email}>{p.name || p.email}</PageTitle>
      </div>
      {!p.email_verified_at && !p.is_admin && (
        <Panel title="Email not verified" aside={<Badge status="pending" label="Pending" />}>
          <p className="mb-4 text-[14px] text-body">Until they verify {p.email}, they can build pages but can&apos;t publish them or receive payouts.</p>
          <EmailVerificationControls creatorId={p.id} />
        </Panel>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Balance owed" value={formatPaise(owed)} />
        <Stat label="Available now" value={formatPaise(available)} sub="Sales older than 24 hours" />
        <Stat label="Gross sales" value={formatPaise(Number(balance?.gross_sales_paise ?? 0))} />
        <Stat label="Paid out" value={formatPaise(Number(balance?.paid_out_paise ?? 0))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Payouts" aside={p.payouts_paused ? <Badge status="failed" label="Paused" /> : p.payout_bank_submitted_at ? <Badge status="live" label="Bank added" /> : <Badge status="pending" label="No bank yet" />}>
          <dl className="mb-4 space-y-1 rounded-2xl bg-surface-soft p-4 text-[14px]">
            {p.payout_bank_submitted_at ? (
              <>
                <div>Name: <span className="select-all font-medium">{p.payout_account_name}</span></div>
                <div>A/c: <span className="select-all font-mono">{p.payout_account_number}</span> · IFSC: <span className="select-all font-mono">{p.payout_ifsc}</span></div>
                {p.payout_bank_name && <div className="text-body">{p.payout_bank_name}</div>}
                <div className="pt-1">
                  {cheque ? <a href={cheque} target="_blank" rel="noopener noreferrer" className="link">View cancelled cheque ↗</a> : <span className="text-down">Cheque file missing</span>}
                  <span className="text-muted"> · added {new Date(p.payout_bank_submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </>
            ) : (
              <div className="text-body">No bank account submitted yet. They can&apos;t request payouts until they add one in Settings.</div>
            )}
          </dl>
          {payoutsEnabled() ? (
            <PayNowForm creatorId={p.id} availablePaise={available} ready={Boolean(destination)} />
          ) : (
            <p className="text-[14px] text-body">RazorpayX isn&apos;t connected. Set the RAZORPAYX_* keys to send payouts from here.</p>
          )}
          <div className="mt-4 border-t border-hairline pt-4">
            <p className="mb-3 text-[13px] text-body">Paused creators can&apos;t request payouts.</p>
            <PausePayoutsButton creatorId={p.id} paused={p.payouts_paused} />
          </div>
          <details className="mt-4 border-t border-hairline pt-4">
            <summary className="link cursor-pointer text-[14px]">Record a payout made outside RazorpayX</summary>
            <div className="mt-3"><PayoutForm creatorId={p.id} suggestedPaise={owed} /></div>
          </details>
        </Panel>
        <Panel title="Plan" aside={<Badge status={hasCreatorPlan(p) ? "live" : "archived"} label={p.is_admin ? "Admin" : hasCreatorPlan(p) ? "Creator" : "Free"} />}>
          <p className="mb-4 text-[14px] text-body">
            Status: {p.plan_status}
            {p.plan_current_period_end ? `, until ${new Date(p.plan_current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
            {p.razorpay_subscription_id ? ` · ${p.razorpay_subscription_id}` : ""}
          </p>
          {!p.is_admin && <PlanForm creatorId={p.id} onPaidPlan={hasCreatorPlan(p)} hasSubscription={Boolean(p.razorpay_subscription_id)} />}
          <div className="mt-5 border-t border-hairline pt-5">
            <p className="mb-3 text-[14px] text-body">Current fee: <b className="text-ink">{feePercentFor(p)}%</b> per sale{p.plan_interval ? ` · billed ${p.plan_interval}ly` : ""}</p>
            <FeeForm creatorId={p.id} currentBps={p.commission_bps ?? null} />
          </div>
        </Panel>
        <Panel title="Manual adjustment">
          <AdjustmentForm creatorId={p.id} />
        </Panel>
      </div>
      <h2 className="text-[20px] font-semibold">Payouts</h2>
      <PayoutsTable payouts={(payouts ?? []) as Payout[]} />
      <h2 className="text-[20px] font-semibold">Ledger</h2>
      <LedgerTable entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
