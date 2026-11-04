"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMyVerificationEmail } from "@/app/(marketing)/auth-actions";

// Shown at the top of every dashboard page until the creator verifies their
// email. linkSent: a link already went out (at signup or a resend), so the
// banner points to the inbox. canResend: the last one was over 10 minutes ago,
// so "Send again" is offered; until then one signup means one email.
export function VerifyEmailBanner({ email, linkSent, canResend }: { email: string; linkSent: boolean; canResend: boolean }) {
  const params = useSearchParams();
  const invalid = params.get("verify") === "invalid";
  const [state, action, pending] = useActionState(sendMyVerificationEmail, null);
  const sent = state?.sentTo ?? (linkSent && !state ? email : null);
  const waiting = !invalid && ((linkSent && !canResend) || !!state?.sentTo);

  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-accent-yellow/40 bg-accent-yellow/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 gap-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-accent-yellow" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="min-w-0 text-[14px]">
          <p className="font-semibold text-ink">Email verification pending</p>
          <p className="text-body">
            {invalid
              ? "That verification link has expired or was already replaced. Send yourself a new one."
              : sent
                ? <>We sent a link to <b className="break-all">{sent}</b>. Open it on any device to verify. Not there? Check spam or promotions.</>
                : <>Verify <b className="break-all">{email}</b> to publish your pages and receive payouts. You can keep building in the meantime.</>}
          </p>
          {state?.error && <p className="mt-1 font-medium text-down">{state.error}</p>}
        </div>
      </div>
      {waiting ? (
        <p className="shrink-0 text-[13px] text-muted">Didn&apos;t get it? You can send another in a few minutes.</p>
      ) : (
        <form action={action} className="shrink-0">
          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full rounded-full bg-ink px-5 text-[14px] font-semibold text-white transition disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Sending…" : sent ? "Send again" : "Send verification email"}
          </button>
        </form>
      )}
    </div>
  );
}

// One-off confirmation after clicking the link in the email.
export function VerifiedNotice() {
  const params = useSearchParams();
  const [hidden, setHidden] = useState(false);
  if (hidden || params.get("verify") !== "done") return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-up/30 bg-up/10 p-4 text-[14px] sm:px-5">
      <p className="text-ink"><b>Your email is verified.</b> You can now publish your pages and receive payouts.</p>
      <button type="button" onClick={() => setHidden(true)} className="shrink-0 text-[20px] leading-none text-muted" aria-label="Dismiss">×</button>
    </div>
  );
}
