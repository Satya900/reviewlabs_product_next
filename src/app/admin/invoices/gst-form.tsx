"use client";

import { useActionState } from "react";
import { saveGstSettings } from "../actions";
import { Button, Field, FormMessage, cx, inputClass, textareaClass } from "@/components/ui";

export type GstSettings = { legal_name: string | null; trade_name: string | null; gstin: string | null; address: string | null; sac: string };

export function GstSettingsForm({ initial }: { initial: GstSettings }) {
  const [state, action, pending] = useActionState(saveGstSettings, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="GSTIN"><input name="gstin" defaultValue={initial.gstin ?? ""} required maxLength={15} className={cx(inputClass, "num uppercase")} /></Field>
      <Field label="Proprietor's legal name" hint="Exactly as on the GST certificate."><input name="legal_name" defaultValue={initial.legal_name ?? ""} required className={inputClass} /></Field>
      <Field label="Trade name (business)" hint="Shown as the seller on invoices."><input name="trade_name" defaultValue={initial.trade_name ?? ""} className={inputClass} /></Field>
      <Field label="SAC code"><input name="sac" defaultValue={initial.sac} maxLength={8} className={cx(inputClass, "num")} /></Field>
      <div className="sm:col-span-2">
        <Field label="Registered address"><textarea name="address" defaultValue={initial.address ?? ""} required rows={3} className={textareaClass} /></Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Save GST details"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
