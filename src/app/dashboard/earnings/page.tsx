import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat } from "@/components/ui";
import { feePercentFor } from "@/lib/plans";
import { LedgerTable } from "@/components/ledger-table";
import type { LedgerEntry } from "@/lib/types";

export default async function EarningsPage() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const [{ data: balance }, { data: entries }] = await Promise.all([
    supabase.from("creator_balances").select("*").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("ledger_entries").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(300),
  ]);

  return (
    <>
      <PageTitle sub={`Balance = sales, minus the ${feePercentFor(profile)}% all-inclusive fee (payment gateway included), refunds and payouts already sent.`}>
        Earnings
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Balance owed to you" value={formatPaise(balance?.balance_paise ?? 0)} />
        <Stat label="Gross sales" value={formatPaise(balance?.gross_sales_paise ?? 0)} />
        <Stat label="Paid out" value={formatPaise(balance?.paid_out_paise ?? 0)} />
      </div>
      <LedgerTable entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
