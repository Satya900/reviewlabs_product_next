"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resendVerification, sendPasswordReset, signIn, signUp, updatePassword } from "@/app/(marketing)/auth-actions";
import { Button, Field, FormMessage, Notice, inputClass } from "@/components/ui";

function PasswordInput({ name, autoComplete, placeholder }: { name: string; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={show ? "text" : "password"} required minLength={name === "password" && autoComplete === "current-password" ? 1 : 8} autoComplete={autoComplete} placeholder={placeholder} className={`${inputClass} pr-16`} />
      <button type="button" onClick={() => setShow(!show)} className="link absolute right-4 top-1/2 -translate-y-1/2 text-[13px]">
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function ResendVerification({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, null);
  if (state?.sentTo) return <Notice tone="good">We sent a new verification link to {state.sentTo}.</Notice>;
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button disabled={pending} className="link text-[14px]">{pending ? "Sending" : "Resend the verification email"}</button>
    </form>
  );
}

function CheckInbox({ email, what }: { email: string; what: string }) {
  return (
    <div className="space-y-4">
      <Notice tone="good">
        We sent {what} to <b>{email}</b>. Open it on any device and click the link. Check spam or promotions if you don&apos;t see it within a minute.
      </Notice>
      <ResendVerification email={email} />
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <input type="email" name="email" required autoFocus autoComplete="email" className={inputClass} />
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-semibold">Password</span>
          <Link href="/forgot-password" className="link text-[13px]">Forgot password?</Link>
        </div>
        <PasswordInput name="password" autoComplete="current-password" />
      </div>
      <FormMessage state={state} />
      {state?.unverifiedEmail && <ResendVerification email={state.unverifiedEmail} />}
      <Button loading={pending} type="submit" className="h-12 w-full" disabled={pending}>{pending ? "Signing in" : "Log in"}</Button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, null);
  if (state?.sentTo) return <CheckInbox email={state.sentTo} what="a verification link" />;
  return (
    <form action={action} className="space-y-4">
      <Field label="Your name">
        <input name="name" required autoFocus autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Email">
        <input type="email" name="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <Button loading={pending} type="submit" className="h-12 w-full" disabled={pending}>{pending ? "Creating account" : "Create free account"}</Button>
      <p className="text-center text-[13px] text-muted">
        By creating an account you agree to our <Link href="/terms" className="link">terms</Link> and <Link href="/privacy" className="link">privacy policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(sendPasswordReset, null);
  if (state?.sentTo) {
    return <Notice tone="good">If <b>{state.sentTo}</b> has an account, a password reset link is on its way. It expires in an hour.</Notice>;
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input type="email" name="email" required autoFocus autoComplete="email" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button loading={pending} type="submit" className="h-12 w-full" disabled={pending}>{pending ? "Sending" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput name="confirm" autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <Button loading={pending} type="submit" className="h-12 w-full" disabled={pending}>{pending ? "Saving" : "Save new password"}</Button>
    </form>
  );
}
