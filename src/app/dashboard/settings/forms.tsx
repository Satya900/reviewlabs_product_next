"use client";

import { useActionState } from "react";
import { sendTestMetaEvent, updatePixel, updateProfile } from "../actions";
import { Badge, Button, Field, FormMessage, inputClass } from "@/components/ui";
import type { Profile } from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Display name"><input name="name" defaultValue={profile.name ?? ""} className={inputClass} /></Field>
      <Field label="UPI ID" hint="For example: yourname@okhdfcbank. We pay to UPI when it's set, otherwise to your bank account."><input name="payout_upi" defaultValue={profile.payout_upi ?? ""} className={inputClass} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Account holder"><input name="payout_account_name" defaultValue={profile.payout_account_name ?? ""} className={inputClass} /></Field>
        <Field label="Account number"><input name="payout_account_number" defaultValue={profile.payout_account_number ?? ""} inputMode="numeric" className={inputClass} /></Field>
        <Field label="IFSC"><input name="payout_ifsc" defaultValue={profile.payout_ifsc ?? ""} className={inputClass} /></Field>
      </div>
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
  const connected = Boolean(pixelId && hasToken);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={connected ? "live" : "archived"} label={connected ? "Meta tracking on" : "Meta tracking off"} />
        {connected && testEventCode && <Badge status="pending" label="Test mode" />}
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
          <li>Go to <b>Settings</b>, scroll to <b>Conversions API</b>, click <b>Generate access token</b> and copy it.</li>
          <li>Paste both below and click Save.</li>
          <li>Optional: copy the code from the <b>Test events</b> tab into Testing below. We then check your token with Meta when you save, and you can use Send test event.</li>
        </ol>
      </details>

      <form action={action} className="space-y-4">
        <Field label="Pixel ID (required)">
          <input name="pixel_id" defaultValue={pixelId} inputMode="numeric" placeholder="2185635582336243" className={inputClass} />
        </Field>
        <Field
          label="Conversions API access token (required)"
          hint={hasToken ? "A token is saved and hidden. Leave this blank to keep it, or paste a new one to replace it." : "Starts with EAA. Stored encrypted and never shown again."}
        >
          <input name="capi_token" type="password" autoComplete="off" placeholder={hasToken ? "••••••••••••" : "EAA..."} className={inputClass} />
        </Field>
        <details className="rounded-2xl border border-hairline p-4" open={Boolean(testEventCode)}>
          <summary className="cursor-pointer text-[14px] font-semibold">Testing (optional)</summary>
          <div className="mt-3">
            <Field label="Test event code" hint="From the Test events tab in Events Manager. With a code, Save checks your token with Meta. Remove it before real sales, or Meta treats your events as tests.">
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

      {connected && testEventCode && (
        <form action={testAction} className="flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
          <Button loading={testing} type="submit" variant="secondary" disabled={testing}>{testing ? "Sending" : "Send test event"}</Button>
          <FormMessage state={testState} />
        </form>
      )}
    </div>
  );
}
