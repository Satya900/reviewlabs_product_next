"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { BankDetailsForm } from "@/components/bank-details-form";
import { maskAccountNumber } from "@/lib/bank-details";
import { sendTestMetaEvent, updatePixel, updateProfile } from "../actions";
import { Badge, Button, Field, FormMessage, inputClass } from "@/components/ui";
import type { Profile } from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Display name"><input name="name" defaultValue={profile.name ?? ""} className={inputClass} /></Field>
      <div className="flex items-center gap-3">
        <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Save"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PixelForm({ pixelId, testEventCode, hasToken }: { pixelId: string; testEventCode: string; hasToken: boolean }) {
  const [state, action, pending] = useActionState(updatePixel, null);
  const [testState, testAction, testing] = useActionState(sendTestMetaEvent, null);
  const connected = Boolean(pixelId);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={connected ? "live" : "archived"} label={connected ? "Meta Pixel on" : "Meta tracking off"} />
        {connected && <Badge status={hasToken ? "live" : "archived"} label={hasToken ? "Conversions API on" : "Browser only"} />}
        {connected && hasToken && testEventCode && <Badge status="pending" label="Test mode" />}
      </div>

      <details className="group rounded-2xl bg-surface-soft p-4">
        <summary className="link cursor-pointer list-none text-[14px] [&::-webkit-details-marker]:hidden">How do I find these? (2 minutes)</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-body">
          <li>
            Open{" "}
            <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" className="link">Meta Events Manager</a>{" "}
            and pick your pixel. No pixel yet? Click Connect data, choose Web, and give it a name.
          </li>
          <li>Copy the <b>Pixel ID</b>: the 15 or 16 digit number under the pixel&apos;s name.</li>
          <li>Paste it below and click Save. That&apos;s enough to start tracking.</li>
          <li>Recommended: in the pixel&apos;s <b>Settings</b>, scroll to <b>Conversions API</b>, click <b>Generate access token</b> and paste it below too. Then sales still reach Meta when buyers use ad blockers or close the tab before the success page.</li>
          <li>Optional, with a token: copy the code from the <b>Test events</b> tab into Testing below. We then check your token with Meta when you save, and you can use Send test event.</li>
        </ol>
      </details>

      <form action={action} className="space-y-4">
        <Field label="Pixel ID (required)">
          <input name="pixel_id" defaultValue={pixelId} inputMode="numeric" placeholder="2185635582336243" className={inputClass} />
        </Field>
        <Field
          label="Conversions API access token (optional, recommended)"
          hint={hasToken ? "A token is saved and hidden. Leave this blank to keep it, or paste a new one to replace it." : "Without it, events come from the buyer's browser only. Starts with EAA. Stored encrypted and never shown again."}
        >
          <input name="capi_token" type="password" autoComplete="off" placeholder={hasToken ? "••••••••••••" : "EAA..."} className={inputClass} />
        </Field>
        {hasToken && (
          <label className="flex items-center gap-2 text-[14px] text-body">
            <input type="checkbox" name="remove_token" className="accent-primary" />
            Remove the saved token (browser events only)
          </label>
        )}
        <details className="rounded-2xl border border-hairline p-4" open={Boolean(testEventCode)}>
          <summary className="cursor-pointer text-[14px] font-semibold">Testing (optional)</summary>
          <div className="mt-3">
            <Field label="Test event code" hint="From the Test events tab in Events Manager. Applies to server events, so it needs a token. With a code, Save checks your token with Meta. Remove it before real sales, or Meta treats your events as tests.">
              <input name="test_event_code" defaultValue={testEventCode} placeholder="TEST12345" className={inputClass} />
            </Field>
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Save"}</Button>
          <FormMessage state={state} />
        </div>
        <p className="text-[13px] text-muted">To turn Meta tracking off, clear the Pixel ID and save.</p>
      </form>

      {connected && hasToken && testEventCode && (
        <form action={testAction} className="flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
          <Button loading={testing} type="submit" variant="secondary" disabled={testing}>{testing ? "Sending" : "Send test event"}</Button>
          <FormMessage state={testState} />
        </form>
      )}
    </div>
  );
}

export function BankAccountSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const saved = Boolean(profile.payout_bank_submitted_at && profile.payout_account_number);
  const [editing, setEditing] = useState(!saved);
  const [done, setDone] = useState(false);

  if (!editing) {
    return (
      <div className="space-y-4">
        {done && <p className="rounded-2xl bg-up/10 p-3 text-[14px] font-medium text-ink">Bank details saved. You can request payouts from Earnings.</p>}
        <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
          <div><dt className="text-muted">Account holder</dt><dd className="font-medium">{profile.payout_account_name}</dd></div>
          <div><dt className="text-muted">Account number</dt><dd className="num font-medium">{maskAccountNumber(profile.payout_account_number ?? "")}</dd></div>
          <div><dt className="text-muted">IFSC</dt><dd className="num font-medium">{profile.payout_ifsc}</dd></div>
          <div><dt className="text-muted">Bank</dt><dd className="font-medium">{profile.payout_bank_name ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Cancelled cheque</dt><dd className="font-medium">Uploaded {new Date(profile.payout_bank_submitted_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
        </dl>
        <Button type="button" variant="secondary" onClick={() => { setDone(false); setEditing(true); }}>Change bank account</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {saved && <p className="text-[14px] text-body">Changing your bank account needs a cancelled cheque from the new account. <button type="button" className="link" onClick={() => setEditing(false)}>Keep the current one</button></p>}
      <BankDetailsForm creatorId={profile.id} onSaved={() => { setDone(true); setEditing(false); router.refresh(); }} />
    </div>
  );
}
