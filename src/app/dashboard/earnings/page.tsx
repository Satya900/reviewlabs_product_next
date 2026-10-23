import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat } from "@/components/ui";
import { feePercentFor } from "@/lib/plans";
import { LedgerTable } from "@/components/ledger-table";
import { PayoutsTable } from "@/components/payouts-table";
import { maskAccountNumber } from "@/lib/bank-details";
import type { PayoutRequest } from "@/lib/payout-requests";
import { PayoutRequestsTable } from "@/components/payout-requests-table";
import { RequestPayout } from "./request-payout";
import type { LedgerEntry, Payout } from "@/lib/types";

export default async function EarningsPage() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const [{ data: balance }, { data: entries }, { data: payouts }, { data: requests }] = await Promise.all([
    supabase.from("creator_balances").select("*").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("ledger_entries").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(300),
    supabase.from("payouts").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("payout_requests").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const total = Number(balance?.balance_paise ?? 0);
  const available = Number(balance?.available_paise ?? 0);
  const onHold = Math.max(total - available, 0);
  const pending = ((requests ?? []) as PayoutRequest[]).find((r) => r.status === "pending") ?? null;
  const bankReady = Boolean(profile.payout_bank_submitted_at && profile.payout_account_number);

  return (
    <>
      <PageTitle sub={`Balance = sales, minus the ${feePercentFor(profile)}% fee (payment gateway and GST included), refunds and payouts already sent.`}>
        Earnings
      </PageTitle>

      <RequestPayout
        availablePaise={Math.max(available, 0)}
        pending={pending}
        bank={bankReady ? `${profile.payout_bank_name ?? profile.payout_ifsc} · ${maskAccountNumber(profile.payout_account_number ?? "")}` : null}
        emailVerified={Boolean(profile.email_verified_at)}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Available to withdraw" value={formatPaise(Math.max(available, 0))} sub="Minimum payout ₹500" />
        <Stat label="On hold (last 24 hours)" value={formatPaise(onHold)} />
        <Stat label="Paid out" value={formatPaise(balance?.paid_out_paise ?? 0)} sub={`Gross sales ${formatPaise(balance?.gross_sales_paise ?? 0)}`} />
      </div>

      {(requests ?? []).length > 0 && (
        <>
          <h2 className="text-[20px] font-semibold">Payout requests</h2>
          <PayoutRequestsTable requests={(requests ?? []) as PayoutRequest[]} />
        </>
      )}

      <h2 className="text-[20px] font-semibold">Payouts</h2>
      <PayoutsTable payouts={(payouts ?? []) as Payout[]} />

      <h2 className="text-[20px] font-semibold">All transactions</h2>
      <LedgerTable entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
