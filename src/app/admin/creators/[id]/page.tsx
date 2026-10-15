import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, Panel, Stat } from "@/components/ui";
import { LedgerTable } from "@/components/ledger-table";
import type { LedgerEntry } from "@/lib/types";
import { AdjustmentForm, FeeForm, PayoutForm, PlanForm } from "../../forms";
import { feePercentFor } from "@/lib/plans";
import { hasCreatorPlan } from "@/lib/plans";
import { Badge } from "@/components/ui";

export default async function AdminCreator({ params }: PageProps<"/admin/creators/[id]">) {
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: p }, { data: balance }, { data: entries }] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("creator_balances").select("*").eq("creator_id", id).maybeSingle(),
    db.from("ledger_entries").select("*").eq("creator_id", id).order("created_at", { ascending: false }).limit(300),
  ]);
  if (!p) notFound();
  const owed = Number(balance?.balance_paise ?? 0);

  return (
    <>
      <div className="space-y-1">
        <Link href="/admin" className="link text-[14px]">← Back to creators</Link>
        <PageTitle sub={p.email}>{p.name || p.email}</PageTitle>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Balance owed" value={formatPaise(owed)} />
        <Stat label="Gross sales" value={formatPaise(Number(balance?.gross_sales_paise ?? 0))} />
        <Stat label="Paid out" value={formatPaise(Number(balance?.paid_out_paise ?? 0))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Record a payout">
          <dl className="mb-4 space-y-1 rounded-2xl bg-surface-soft p-4 text-[14px]">
            <div>UPI: <span className="select-all font-mono">{p.payout_upi ?? "not set"}</span></div>
            <div>A/c: <span className="select-all font-mono">{p.payout_account_number ?? "not set"}</span></div>
            <div>IFSC: <span className="select-all font-mono">{p.payout_ifsc ?? "not set"}</span></div>
            <div>Name: {p.payout_account_name ?? "not set"}</div>
          </dl>
          <PayoutForm creatorId={p.id} suggestedPaise={owed} />
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
      <h2 className="text-[20px] font-semibold">Ledger</h2>
      <LedgerTable entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
