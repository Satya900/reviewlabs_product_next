"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { savePageTracking, sendPageTestEvent, switchToAccountPixel } from "./tracking-actions";
import { Badge, Button, Field, FormMessage, inputClass, cx } from "@/components/ui";
import type { ActionState } from "../../actions";

type Props = {
  pageId: string;
  own: { pixelId: string; testEventCode: string } | null;
  accountPixelId: string | null;
};

export function TrackingPanel({ pageId, own, accountPixelId }: Props) {
  const [mode, setMode] = useState<"account" | "own">(own ? "own" : "account");
  const [state, action, pending] = useActionState(savePageTracking, null);
  const [switchState, setSwitchState] = useState<ActionState>(null);
  const [testState, setTestState] = useState<ActionState>(null);
  const [busy, start] = useTransition();

  const status = own
    ? { on: true, label: `Own pixel · ${own.pixelId}` }
    : accountPixelId
      ? { on: true, label: `Account pixel · ${accountPixelId}` }
      : { on: false, label: "Not tracking" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge status={status.on ? "live" : "archived"} label={status.label} />
        {own?.testEventCode && <Badge status="pending" label="Test mode" />}
      </div>

      <div className="grid gap-2">
        {([
          ["account", "Use my account pixel", accountPixelId ? "The pixel from Settings." : "Not set up yet in Settings."],
          ["own", "Use a different pixel for this page", "For a separate ad account or product."],
        ] as const).map(([value, title, sub]) => (
          <label
            key={value}
            className={cx("flex cursor-pointer gap-3 rounded-2xl border p-3", mode === value ? "border-primary bg-primary-soft" : "border-hairline")}
          >
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-primary" />
            <span>
              <span className="block text-[14px] font-semibold">{title}</span>
              <span className="block text-[13px] text-muted">{sub}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === "account" && (
        <div className="space-y-2 text-[13px] text-body">
          {!accountPixelId && (
            <p>
              Add your Pixel ID and token in <Link href="/dashboard/settings" className="link">Settings</Link> to track all your pages at once.
            </p>
          )}
          {own && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => start(async () => setSwitchState(await switchToAccountPixel(pageId)))}
            >
              {busy ? "Switching" : "Remove this page's pixel"}
            </Button>
          )}
          <FormMessage state={switchState} />
        </div>
      )}

      {mode === "own" && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="page_id" value={pageId} />
          <Field label="Pixel ID (required)">
            <input name="pixel_id" defaultValue={own?.pixelId ?? ""} inputMode="numeric" placeholder="2185635582336243" className={inputClass} />
          </Field>
          <Field
            label="Conversions API token (required)"
            hint={own ? "A token is saved and hidden. Leave blank to keep it." : "Starts with EAA. Stored encrypted."}
          >
            <input name="capi_token" type="password" autoComplete="off" placeholder={own ? "••••••••••••" : "EAA..."} className={inputClass} />
          </Field>
          <Field label="Test event code (optional)" hint="With a code, Save checks the token with Meta. Remove it before real sales.">
            <input name="test_event_code" defaultValue={own?.testEventCode ?? ""} placeholder="TEST12345" className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save pixel"}</Button>
            {own?.testEventCode && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => start(async () => setTestState(await sendPageTestEvent(pageId)))}
              >
                {busy ? "Sending" : "Send test event"}
              </Button>
            )}
          </div>
          <FormMessage state={state} />
          <FormMessage state={testState} />
        </form>
      )}
    </div>
  );
}
