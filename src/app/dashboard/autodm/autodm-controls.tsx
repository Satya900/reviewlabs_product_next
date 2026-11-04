"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, FormMessage, cx, inputClass } from "@/components/ui";
import { deleteAutomation, disconnectInstagram, requestAutodmAccess, setAutomationActive, syncNow } from "./actions";

export function AutomationToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Pause automation" : "Turn automation on"}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(() => setAutomationActive(id, next));
      }}
      className={cx("relative h-7 w-12 rounded-full transition", on ? "bg-primary" : "bg-surface-strong")}
    >
      <span className={cx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

export function SyncNowButton() {
  const [state, action, pending] = useActionState(syncNow, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button variant="secondary" loading={pending} disabled={pending} type="submit">{pending ? "Checking" : "Check comments now"}</Button>
      <FormMessage state={state} />
    </form>
  );
}

export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)} className="text-[14px] font-semibold text-down">Disconnect</button>;
  }
  return (
    <span className="flex items-center gap-3 text-[14px]">
      <span className="text-body">Delete all automations and history?</span>
      <button type="button" disabled={pending} onClick={() => start(() => disconnectInstagram())} className="font-semibold text-down">{pending ? "Disconnecting" : "Yes, disconnect"}</button>
      <button type="button" onClick={() => setConfirming(false)} className="font-semibold text-ink">Cancel</button>
    </span>
  );
}

export function DeleteAutomationButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) return <Button variant="danger" type="button" onClick={() => setConfirming(true)}>Delete automation</Button>;
  return (
    <span className="flex items-center gap-3 text-[14px]">
      <span className="text-body">Delete it? Its history stays.</span>
      <Button variant="danger" type="button" loading={pending} onClick={() => start(() => deleteAutomation(id))}>Yes, delete</Button>
      <button type="button" onClick={() => setConfirming(false)} className="font-semibold text-ink">Cancel</button>
    </span>
  );
}

// Early access: Instagram username + the Facebook account Meta should invite.
export function AccessRequestForm({ initial }: { initial?: { ig: string; facebook: string } }) {
  const [state, action, pending] = useActionState(requestAutodmAccess, null);
  const [ig, setIg] = useState(initial?.ig ?? "");
  const [facebook, setFacebook] = useState(initial?.facebook ?? "");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Instagram username" hint="The professional account you post from.">
        <input name="ig_username" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@yourname" required className={inputClass} />
      </Field>
      <Field label="Facebook profile link or email" hint="Meta sends the invite to this Facebook account.">
        <input name="facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/yourname" required className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button loading={pending} type="submit" disabled={pending}>{pending ? "Sending" : "Request early access"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
