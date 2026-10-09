"use client";

import { useActionState, useState } from "react";
import { addAdjustment, chargeSubscriptionsNow, recordPayout, refundOrder, updateSubscription } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { paiseToRupeesString } from "@/lib/money";

export function ChargeSubscriptionsButton() {
  const [state, action, pending] = useActionState(chargeSubscriptionsNow, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Charging" : "Charge this month's plan fees"}</Button>
      <FormMessage state={state} />
    </form>
  );
}

export function PayoutForm({ creatorId, suggestedPaise }: { creatorId: string; suggestedPaise: number }) {
  const [state, action, pending] = useActionState(recordPayout, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="creator_id" value={creatorId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (₹)"><input name="amount" defaultValue={suggestedPaise > 0 ? paiseToRupeesString(suggestedPaise) : ""} inputMode="decimal" required className={inputClass} /></Field>
        <Field label="Method">
          <select name="method" className={inputClass}>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="UTR / reference"><input name="reference" required className={inputClass} /></Field>
      <Field label="Note"><input name="note" className={inputClass} /></Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving" : "Record payout"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AdjustmentForm({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState(addAdjustment, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="creator_id" value={creatorId} />
      <Field label="Amount (₹)" hint="A positive number adds to the balance. A negative one deducts."><input name="amount" required className={inputClass} /></Field>
      <Field label="Reason"><input name="description" required className={inputClass} /></Field>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Add adjustment"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SubscriptionForm({ creatorId, active, planPaise }: { creatorId: string; active: boolean; planPaise: number }) {
  const [state, action, pending] = useActionState(updateSubscription, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="creator_id" value={creatorId} />
      <Field label="Monthly plan (₹)"><input name="plan" defaultValue={paiseToRupeesString(planPaise)} className={inputClass} /></Field>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={active} /> Plan active</label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Save"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(refundOrder, null);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="link text-[14px]">Refund</button>;
  }
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm("Issue this refund through Razorpay?")) e.preventDefault(); }}
      className="w-48 space-y-2"
    >
      <input type="hidden" name="order_id" value={orderId} />
      <input name="amount" placeholder="Amount, blank for full" className={inputClass} />
      <input name="reason" placeholder="Reason" className={inputClass} />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending} className="px-3 py-1">{pending ? "Wait" : "Refund"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="px-3 py-1">Cancel</Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
