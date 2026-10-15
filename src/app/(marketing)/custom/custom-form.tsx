"use client";

import { useActionState, useState } from "react";
import { submitCustomRequest } from "./actions";
import { Button, Field, FormMessage, Notice, inputClass, textareaClass, cx } from "@/components/ui";

const VOLUMES = ["Just starting", "Under ₹25,000", "₹25,000 to ₹1 lakh", "₹1 lakh to ₹5 lakh", "Over ₹5 lakh"];

export function CustomForm() {
  const [state, action, pending] = useActionState(submitCustomRequest, null);
  const [requirements, setRequirements] = useState("");

  if (state?.sent) {
    return (
      <Notice tone="good">
        <p className="text-[16px] font-semibold">Thanks, we&apos;ve got your request.</p>
        <p className="mt-1">We&apos;ll get back to you within one working day to talk through your setup.</p>
      </Notice>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name *"><input name="name" required autoComplete="name" className={inputClass} /></Field>
        <Field label="Email *"><input name="email" type="email" required autoComplete="email" className={inputClass} /></Field>
        <Field label="Phone or WhatsApp"><input name="phone" type="tel" autoComplete="tel" placeholder="98765 43210" className={inputClass} /></Field>
        <Field label="Business or brand"><input name="business" autoComplete="organization" className={inputClass} /></Field>
        <Field label="Website or social profile"><input name="website" placeholder="instagram.com/yourbrand" className={inputClass} /></Field>
        <Field label="Expected monthly sales">
          <select name="monthly_volume" defaultValue="" className={inputClass}>
            <option value="">Choose one</option>
            {VOLUMES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-[14px] font-semibold">What do you need? *</span>
        <div className="relative">
          <textarea
            name="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value.slice(0, 3000))}
            required
            rows={6}
            placeholder="What you sell, how many products, and anything you'd like us to set up or build for you."
            className={cx(textareaClass, "pb-7")}
          />
          <span className="num pointer-events-none absolute bottom-3 right-4 text-[12px] text-muted">{requirements.length}/3000</span>
        </div>
      </label>
      {/* Hidden from people; bots tend to fill it in. */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <FormMessage state={state} />
      <Button type="submit" variant="hero" disabled={pending} className="w-full sm:w-auto">{pending ? "Sending" : "Send my requirements"}</Button>
    </form>
  );
}
