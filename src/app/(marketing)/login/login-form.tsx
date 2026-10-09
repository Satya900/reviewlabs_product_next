"use client";

import { useActionState } from "react";
import { requestLoginLink } from "./actions";
import { Button, Field, FormMessage, Notice, inputClass } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestLoginLink, null);

  if (state?.sentTo) {
    return <Notice tone="good">Check {state.sentTo} for your sign-in link. It works once and expires in an hour.</Notice>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <input type="email" name="email" required autoFocus autoComplete="email" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? "Sending" : "Send sign-in link"}
      </Button>
    </form>
  );
}
