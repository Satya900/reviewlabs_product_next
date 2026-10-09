import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, Panel, Stat } from "@/components/ui";
import { LedgerTable } from "@/components/ledger-table";
import type { LedgerEntry } from "@/lib/types";
import { AdjustmentForm, PayoutForm, SubscriptionForm } from "../../forms";

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
        <Panel title="Monthly plan">
          <SubscriptionForm creatorId={p.id} active={p.subscription_active} planPaise={p.plan_amount_paise} />
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
