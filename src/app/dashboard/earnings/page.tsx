import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat } from "@/components/ui";
import { feePercentFor } from "@/lib/plans";
import { LedgerTable } from "@/components/ledger-table";
import { PayoutsTable } from "@/components/payouts-table";
import { PAYOUT_MIN_PAISE, destinationFor, payoutsEnabled } from "@/lib/payouts";
import type { LedgerEntry, Payout } from "@/lib/types";

export default async function EarningsPage() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const [{ data: balance }, { data: entries }, { data: payouts }] = await Promise.all([
    supabase.from("creator_balances").select("*").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("ledger_entries").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(300),
    supabase.from("payouts").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const total = Number(balance?.balance_paise ?? 0);
  const available = Number(balance?.available_paise ?? 0);
  const onHold = Math.max(total - available, 0);
  const destination = destinationFor(profile);
  const automatic = payoutsEnabled();
  const last = (payouts ?? [])[0] as Payout | undefined;
  const lastFailed =
    last?.provider === "razorpayx" && ["failed", "reversed", "cancelled"].includes(last.status) &&
    (!profile.payout_details_updated_at || new Date(profile.payout_details_updated_at) < new Date(last.created_at));

  return (
    <>
      <PageTitle sub={`Balance = sales, minus the ${feePercentFor(profile)}% fee (payment gateway and GST included), refunds and payouts already sent.`}>
        Earnings
      </PageTitle>

      {!destination ? (
        <Notice tone="warn">
          Add your UPI ID or bank account in <Link href="/dashboard/settings" className="link">Settings</Link> so we can send your earnings.
        </Notice>
      ) : lastFailed ? (
        <Notice tone="warn">
          Your last payout didn&apos;t go through{last?.failure_reason ? `: ${last.failure_reason}` : "."} The money is back in your balance.
          Check your details in <Link href="/dashboard/settings" className="link">Settings</Link> and we&apos;ll send it in the next daily payout.
        </Notice>
      ) : (
        <Notice>
          Payouts go out every day{automatic ? " at 10:00 AM" : ""} to your {destination.label}. Sales are ready to pay 24 hours after they
          happen, once you have at least {formatPaise(PAYOUT_MIN_PAISE)}.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ready for next payout" value={formatPaise(Math.max(available, 0))} />
        <Stat label="On hold (last 24 hours)" value={formatPaise(onHold)} />
        <Stat label="Paid out" value={formatPaise(balance?.paid_out_paise ?? 0)} sub={`Gross sales ${formatPaise(balance?.gross_sales_paise ?? 0)}`} />
      </div>

      <h2 className="text-[20px] font-semibold">Payouts</h2>
      <PayoutsTable payouts={(payouts ?? []) as Payout[]} />

      <h2 className="text-[20px] font-semibold">All transactions</h2>
      <LedgerTable entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <p className={`rounded-2xl p-4 text-[14px] ${tone === "warn" ? "bg-accent-yellow/15 text-ink" : "bg-surface-soft text-body"}`}>{children}</p>
  );
}
