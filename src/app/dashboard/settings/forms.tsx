"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { BankDetailsForm } from "@/components/bank-details-form";
import { maskAccountNumber } from "@/lib/bank-details";
import { updateProfile } from "../actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
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
