"use client";

import { useActionState, useState, useTransition } from "react";
import { createCoupon, deleteCoupon, setCouponActive } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

export function CouponForm({ pages }: { pages: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(createCoupon, null);
  const [type, setType] = useState<"percent" | "flat">("percent");
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Code" hint="Buyers type this. Letters and numbers.">
          <input name="code" required placeholder="DIWALI20" className={`${inputClass} uppercase`} />
        </Field>
        <Field label="Type">
          <select name="discount_type" value={type} onChange={(e) => setType(e.target.value as "percent" | "flat")} className={inputClass}>
            <option value="percent">Percent off</option>
            <option value="flat">Amount off (₹)</option>
          </select>
        </Field>
        <Field label={type === "percent" ? "Percent off" : "Amount off (₹)"}>
          <input name="value" required inputMode="decimal" placeholder={type === "percent" ? "20" : "100"} className={inputClass} />
        </Field>
        <Field label="Applies to">
          <select name="page_id" className={inputClass} defaultValue="">
            <option value="">All my pages</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="Max uses (optional)">
          <input name="max_uses" inputMode="numeric" placeholder="No limit" className={inputClass} />
        </Field>
        <Field label="Last valid day (optional)">
          <input name="expires_on" type="date" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating" : "Create coupon"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CouponActions({ id, active, canDelete }: { id: string; active: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-3 text-[13px]">
      <button type="button" disabled={pending} onClick={() => start(() => setCouponActive(id, !active))} className="link text-[14px]">
        {active ? "Turn off" : "Turn on"}
      </button>
      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => { if (confirm("Delete this coupon?")) start(() => deleteCoupon(id)); }}
          className="link text-[14px]"
        >
          Delete
        </button>
      )}
    </span>
  );
}
