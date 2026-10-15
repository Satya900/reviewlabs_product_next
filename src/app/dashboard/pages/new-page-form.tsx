"use client";

import { useActionState } from "react";
import { createPage } from "../actions";
import { Button, FormMessage, inputClass } from "@/components/ui";

export function NewPageForm() {
  const [state, action, pending] = useActionState(createPage, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="title" placeholder="What are you selling? For example: Notion budget template" required className={inputClass} />
        <Button loading={pending} type="submit" disabled={pending} className="shrink-0">{pending ? "Creating" : "Create page"}</Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
