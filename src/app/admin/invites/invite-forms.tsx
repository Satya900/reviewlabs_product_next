"use client";

import { useActionState, useTransition } from "react";
import { addInvite, removeInvite } from "../invites-actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState(addInvite, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email"><input type="email" name="email" required className={inputClass} /></Field>
        <Field label="Note (optional)"><input name="note" placeholder="For example: Instagram, fitness ebooks" className={inputClass} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Adding" : "Add invite"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RemoveInviteButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => removeInvite(email))} className="link text-[14px]">
      {pending ? "Removing" : "Remove"}
    </button>
  );
}
