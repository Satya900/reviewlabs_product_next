"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button, FormMessage, buttonClass, cx, inputClass } from "@/components/ui";
import { formatPaise, paiseToRupeesString } from "@/lib/money";
import { PAYOUT_REQUEST_MIN_PAISE } from "@/lib/bank-details";
import type { PayoutRequest } from "@/lib/payout-requests";
import { cancelPayoutRequest, requestPayout } from "../payout-actions";

export function RequestPayout({ availablePaise, pending, bank, emailVerified }: {
  availablePaise: number;
  pending: PayoutRequest | null;
  bank: string | null; // "HDFC Bank, Koramangala · •••• 1234", or null when not added yet
  emailVerified: boolean;
}) {
  const [state, action, submitting] = useActionState(requestPayout, null);
  const [amount, setAmount] = useState(paiseToRupeesString(availablePaise));
  const [cancelState, setCancelState] = useState<{ error?: string; ok?: string } | null>(null);
  const [cancelling, startCancel] = useTransition();
  const enough = availablePaise >= PAYOUT_REQUEST_MIN_PAISE;

  let body: React.ReactNode;
  if (pending) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold">{formatPaise(pending.amount_paise)} requested, in review</p>
          <p className="text-[14px] text-body">To {pending.bank_name ?? pending.ifsc}. We&apos;ll email you when it&apos;s sent.</p>
          <FormMessage state={cancelState} />
        </div>
        <Button type="button" variant="secondary" disabled={cancelling} onClick={() => startCancel(async () => setCancelState(await cancelPayoutRequest(pending.id)))}>
          {cancelling ? "Cancelling" : "Cancel request"}
        </Button>
      </div>
    );
  } else if (!bank) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[14px] text-body">Add your bank account and a cancelled cheque to request payouts.</p>
        <Link href="/dashboard/settings" className={cx(buttonClass.primary, "h-11 px-5")}>Add bank account</Link>
      </div>
    );
  } else if (!emailVerified) {
    body = <p className="text-[14px] text-body">Verify your email to request payouts. Use the link at the top of the page.</p>;
  } else if (!enough) {
    body = <p className="text-[14px] text-body">You can request a payout once you have at least {formatPaise(PAYOUT_REQUEST_MIN_PAISE)} available. Sales become available 24 hours after they happen.</p>;
  } else {
    body = (
      <form action={action} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="block text-[14px] font-semibold">Amount (₹)</span>
            <input
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              className={cx(inputClass, "num w-44")}
            />
          </label>
          <Button type="submit" loading={submitting} disabled={submitting}>{submitting ? "Requesting" : "Request payout"}</Button>
        </div>
        <p className="text-[13px] text-muted">
          From {formatPaise(PAYOUT_REQUEST_MIN_PAISE)} up to {formatPaise(availablePaise)}. Paid to {bank}.{" "}
          <Link href="/dashboard/settings" className="link">Change</Link>
        </p>
        <FormMessage state={state} />
      </form>
    );
  }

  return (
    <section className="rounded-3xl border border-hairline bg-canvas p-6">
      <h2 className="mb-3 text-[18px] font-semibold">Withdraw your earnings</h2>
      {state?.ok && !pending ? <FormMessage state={state} /> : body}
    </section>
  );
}
