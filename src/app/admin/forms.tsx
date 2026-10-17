"use client";

import { useActionState, useState, useTransition } from "react";
import { addAdjustment, grantCreatorPlan, markPaidManually, payCreatorNow, recordPayout, refundOrder, revokeCreatorPlan, runPayoutsNow, setCreatorFee, setPayoutsPaused } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { formatPaise, paiseToRupeesString } from "@/lib/money";

export function PayNowForm({ creatorId, availablePaise, ready }: { creatorId: string; availablePaise: number; ready: boolean }) {
  const [state, action, pending] = useActionState(payCreatorNow, null);
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm("Send this payout through RazorpayX now?")) e.preventDefault(); }}
      className="space-y-3"
    >
      <input type="hidden" name="creator_id" value={creatorId} />
      <Field label="Amount (₹)" hint={`Leave empty to pay everything available (${formatPaise(availablePaise)}).`}>
        <input name="amount" inputMode="decimal" placeholder={paiseToRupeesString(Math.max(availablePaise, 0))} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={pending} type="submit" disabled={pending || !ready}>{pending ? "Sending" : "Pay now via RazorpayX"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PausePayoutsButton({ creatorId, paused }: { creatorId: string; paused: boolean }) {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => setState(await setPayoutsPaused(creatorId, !paused)))}>
        {pending ? "Saving" : paused ? "Resume automatic payouts" : "Pause automatic payouts"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function MarkPaidForm({ creatorId, amountPaise }: { creatorId: string; amountPaise: number }) {
  const [state, action, pending] = useActionState(markPaidManually, null);
  // Controlled, so a failed attempt doesn't wipe what the admin typed.
  const [amount, setAmount] = useState(paiseToRupeesString(amountPaise));
  const [utr, setUtr] = useState("");
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="creator_id" value={creatorId} />
      <input name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount sent (₹)" className={`${inputClass} w-28`} />
      <input name="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / reference" required aria-label="UTR" className={`${inputClass} w-44`} />
      <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Mark paid"}</Button>
      <div className="basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function RunPayoutsButton({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        loading={pending}
        disabled={pending || disabled}
        onClick={() => { if (confirm("Pay every creator their available balance now?")) start(async () => setState(await runPayoutsNow())); }}
      >
        {pending ? "Running" : "Run payouts now"}
      </Button>
      <FormMessage state={state} />
    </div>
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
        <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Record payout"}</Button>
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
        <Button loading={pending} type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Add adjustment"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PlanForm({ creatorId, onPaidPlan, hasSubscription }: { creatorId: string; onPaidPlan: boolean; hasSubscription: boolean }) {
  const [state, action, pending] = useActionState(grantCreatorPlan, null);
  const [revokeState, setRevokeState] = useState<{ error?: string; ok?: string } | null>(null);
  const [revoking, start] = useTransition();
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="creator_id" value={creatorId} />
        <Field label="Grant Creator for (days)" hint="For partners or support cases. No Razorpay charge.">
          <input name="days" defaultValue="30" inputMode="numeric" className={inputClass} />
        </Field>
        <div className="flex items-center gap-3">
          <Button loading={pending} type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Grant Creator"}</Button>
          <FormMessage state={state} />
        </div>
      </form>
      {onPaidPlan && (
        <div className="space-y-2 border-t border-hairline pt-4">
          {hasSubscription && <p className="text-[13px] text-muted">This only changes our records. Cancel the subscription in Razorpay too, or it keeps charging.</p>}
          <Button
            type="button"
            variant="danger"
            disabled={revoking}
            onClick={() => { if (confirm("Move this creator to Free?")) start(async () => setRevokeState(await revokeCreatorPlan(creatorId))); }}
          >
            {revoking ? "Moving" : "Move to Free"}
          </Button>
          <FormMessage state={revokeState} />
        </div>
      )}
    </div>
  );
}

export function FeeForm({ creatorId, currentBps }: { creatorId: string; currentBps: number | null }) {
  const [state, action, pending] = useActionState(setCreatorFee, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="creator_id" value={creatorId} />
      <Field label="Custom fee per sale (%)" hint="For custom plan deals. Leave empty for the standard 6% Free / 4% Creator.">
        <input name="fee" defaultValue={currentBps === null ? "" : String(currentBps / 100)} inputMode="decimal" placeholder="Standard" className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <Button loading={pending} type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Save fee"}</Button>
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
        <Button loading={pending} type="submit" variant="danger" disabled={pending} className="px-3 py-1">{pending ? "Wait" : "Refund"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="px-3 py-1">Cancel</Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
