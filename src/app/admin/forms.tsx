"use client";

import { useActionState, useState, useTransition } from "react";
import { addAdjustment, approvePayoutRequest, rejectPayoutRequest, createCreatorAccount, grantCreatorPlan, markEmailVerified, resendCreatorVerification, payCreatorNow, recordPayout, refundOrder, revokeCreatorPlan, setCreatorFee, setPayoutsPaused } from "./actions";
import Link from "next/link";
import { Button, Field, FormMessage, Notice, buttonClass, cx, inputClass } from "@/components/ui";
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
        {pending ? "Saving" : paused ? "Resume payouts" : "Pause payouts"}
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

// 14 characters from an alphabet without look-alikes (no 0/O, 1/l/I), easy to read out.
function generatePassword() {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function CreateCreatorForm() {
  const [state, action, pending] = useActionState(createCreatorAccount, null);
  // Controlled, so a failed attempt keeps what was typed and the password can be shown afterwards.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  if (state?.creatorId) {
    const details = `Your Reviewlabs account is ready.\n\nLog in: ${window.location.origin}/login\nEmail: ${state.email}\nPassword: ${password}\n\nYou can change your password any time with "Forgot password" on the login page.`;
    return (
      <div className="space-y-5">
        <Notice tone="good">{state.ok}</Notice>
        <div>
          <p className="mb-2 text-[15px] font-semibold">Login details to share</p>
          <pre className="whitespace-pre-wrap break-all rounded-2xl bg-surface-soft p-4 text-[14px]">{details}</pre>
          <p className="mt-2 text-[13px] text-muted">The password is only shown here, once. Send it privately (WhatsApp or a direct message), not in a public chat.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={async () => { await navigator.clipboard.writeText(details); setCopied(true); }}>{copied ? "Copied" : "Copy login details"}</Button>
          <Link href={`/admin/creators/${state.creatorId}`} className={cx(buttonClass.secondary, "h-11 px-5")}>Open their account</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Their name">
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Their email">
          <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <Field label="Password" hint="At least 8 characters. Generate one, then share it with them.">
        <div className="flex gap-2">
          <input name="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" spellCheck={false} className={cx(inputClass, "num")} />
          <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>Generate</Button>
        </div>
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[14px] font-semibold">Email verification</legend>
        {([
          ["send", "Email them a verification link now", "They can log in straight away and publish once they click the link."],
          ["later", "Let them verify from their dashboard", "No email now. They see “Email verification pending” at the top and verify when ready."],
          ["verified", "Mark as already verified", "Only if you've confirmed the email is theirs. They can publish and get paid straight away."],
        ] as const).map(([value, label, hint]) => (
          <label key={value} className="flex cursor-pointer gap-3 rounded-2xl border border-hairline p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
            <input type="radio" name="verification" value={value} defaultChecked={value === "send"} className="mt-1 accent-primary" />
            <span>
              <span className="block text-[15px] font-medium">{label}</span>
              <span className="block text-[13px] text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FormMessage state={state} />
      <Button loading={pending} type="submit" disabled={pending}>{pending ? "Creating account" : "Create account"}</Button>
    </form>
  );
}

export function EmailVerificationControls({ creatorId }: { creatorId: string }) {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => setState(await resendCreatorVerification(creatorId)))}>Send verification link</Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => { if (confirm("Mark this email as verified? Only do this if you've confirmed it belongs to them.")) start(async () => setState(await markEmailVerified(creatorId))); }}
        >
          Mark as verified
        </Button>
      </div>
      <FormMessage state={state} />
    </div>
  );
}

export function PayoutRequestActions({ requestId, amountPaise }: { requestId: string; amountPaise: number }) {
  const [approveState, approve, approving] = useActionState(approvePayoutRequest, null);
  const [rejectState, reject, rejecting] = useActionState(rejectPayoutRequest, null);
  const [rejectOpen, setRejectOpen] = useState(false);
  // Controlled, so a failed attempt doesn't wipe what the admin typed.
  const [utr, setUtr] = useState("");
  const [reason, setReason] = useState("");
  if (approveState?.ok || rejectState?.ok) return <FormMessage state={approveState?.ok ? approveState : rejectState} />;
  return (
    <div className="space-y-3">
      <form action={approve} className="space-y-2">
        <input type="hidden" name="request_id" value={requestId} />
        <p className="text-[13px] text-body">Send {formatPaise(amountPaise)} from your bank, then paste the UTR:</p>
        <div className="flex flex-wrap gap-2">
          <input name="utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / reference" required aria-label="UTR" className={`${inputClass} w-48`} />
          <Button loading={approving} type="submit" disabled={approving || rejecting}>{approving ? "Approving" : "Approve as paid"}</Button>
        </div>
        <FormMessage state={approveState} />
      </form>
      {rejectOpen ? (
        <form action={reject} className="space-y-2">
          <input type="hidden" name="request_id" value={requestId} />
          <textarea name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} rows={2} placeholder="Why? The creator sees this, e.g. the cheque doesn't match the account number." aria-label="Reason" className={`${inputClass} h-auto w-full py-2`} />
          <div className="flex gap-2">
            <Button loading={rejecting} type="submit" variant="secondary" disabled={rejecting || approving}>{rejecting ? "Rejecting" : "Reject request"}</Button>
            <button type="button" className="link text-[14px]" onClick={() => setRejectOpen(false)}>Cancel</button>
          </div>
          <FormMessage state={rejectState} />
        </form>
      ) : (
        <button type="button" className="text-[14px] font-medium text-down" onClick={() => setRejectOpen(true)}>Reject…</button>
      )}
    </div>
  );
}
