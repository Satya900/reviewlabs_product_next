"use client";

import { useActionState, useState } from "react";
import { savePolicies } from "./policy-actions";
import { Button, Field, FormMessage, inputClass, textareaClass, cx } from "@/components/ui";

const MAX = 3000;

const REFUND_TEMPLATE =
  "Due to the digital nature of this product, all sales are final. If you have any trouble with your purchase, contact us at the support email above and we'll help.";

function LimitedText({ name, label, hint, value, onChange, placeholder }: { name: string; label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[14px] font-semibold">{label}</span>
      <div className="relative">
        <textarea name={name} value={value} onChange={(e) => onChange(e.target.value.slice(0, MAX))} rows={5} placeholder={placeholder} className={cx(textareaClass, "pb-7")} />
        <span className="num pointer-events-none absolute bottom-3 right-4 text-[12px] text-muted">{value.length}/{MAX}</span>
      </div>
      <span className="block text-[13px] text-muted">{hint}</span>
    </label>
  );
}

export function PoliciesPanel({ pageId, supportEmail, refundPolicy, terms }: { pageId: string; supportEmail: string; refundPolicy: string; terms: string }) {
  const [state, action, pending] = useActionState(savePolicies, null);
  const [refund, setRefund] = useState(refundPolicy);
  const [tnc, setTnc] = useState(terms);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="page_id" value={pageId} />
      <Field label="Support email" hint="Shown on your page as the contact for buyers. Replies to the delivery email for this page also go here.">
        <input name="support_email" type="email" defaultValue={supportEmail} placeholder="support@yourbrand.com" className={inputClass} />
      </Field>
      <LimitedText
        name="refund_policy"
        label="Refund policy"
        hint="Leave empty to show only Reviewlabs' standard refund policy."
        value={refund}
        onChange={setRefund}
        placeholder="For example: all sales are final, or refunds within 7 days if the file doesn't work."
      />
      {!refund && (
        <button type="button" onClick={() => setRefund(REFUND_TEMPLATE)} className="link -mt-3 block text-[13px]">Use a simple template</button>
      )}
      <LimitedText
        name="terms"
        label="Terms and conditions"
        hint="Your own terms for buyers of this product, such as usage rights or disclaimers."
        value={tnc}
        onChange={setTnc}
        placeholder="For example: for personal use only, not for resale. This content is educational and not financial advice."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={pending} type="submit" disabled={pending}>{pending ? "Saving" : "Save policies"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
