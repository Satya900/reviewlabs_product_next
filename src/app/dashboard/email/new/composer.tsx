"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button, Field, FormMessage, cx, inputClass, textareaClass } from "@/components/ui";
import { renderBroadcast } from "@/lib/broadcast-email";
import { audienceSize, sendBroadcast, sendTestBroadcast } from "../actions";

type Item = { id: string; title: string; slug: string; live: boolean };

export function Composer({ creatorName, appUrl, pages, magnets }: { creatorName: string; appUrl: string; pages: Item[]; magnets: Item[] }) {
  const [testState, testAction, testing] = useActionState(sendTestBroadcast, null);
  const [sendState, sendAction, sending] = useActionState(sendBroadcast, null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [audience, setAudience] = useState("all");
  const [ref, setRef] = useState("");
  const [count, setCount] = useState<number | null>(null);

  // How many people the chosen audience reaches.
  useEffect(() => {
    let live = true;
    const needsRef = audience === "page" || audience === "magnet";
    if (needsRef && !ref) {
      Promise.resolve().then(() => live && setCount(null));
    } else {
      audienceSize(audience, needsRef ? ref : null).then((n) => live && setCount(n));
    }
    return () => { live = false; };
  }, [audience, ref]);

  const preview = useMemo(
    () => renderBroadcast({ subject, body: body || "Your message appears here.", buttonLabel, buttonUrl, creatorName }, `${appUrl}/u/preview`).html,
    [subject, body, buttonLabel, buttonUrl, creatorName, appUrl],
  );
  const livePages = pages.filter((p) => p.live);

  return (
    <form action={sendAction} className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <Field label="Send to">
          <select name="audience" value={audience} onChange={(e) => { setAudience(e.target.value); setRef(""); }} className={inputClass}>
            <option value="all">All subscribers</option>
            <option value="buyers">All buyers who opted in</option>
            <option value="leads">All lead magnet sign-ups</option>
            <option value="page">Buyers of one product</option>
            <option value="magnet">Sign-ups of one lead magnet</option>
          </select>
        </Field>
        {(audience === "page" || audience === "magnet") && (
          <Field label={audience === "page" ? "Product" : "Lead magnet"}>
            <select name="audience_ref" value={ref} onChange={(e) => setRef(e.target.value)} required className={inputClass}>
              <option value="">Choose…</option>
              {(audience === "page" ? pages : magnets).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </Field>
        )}
        <p className="text-[14px] text-body">
          {count === null ? " " : count === 0 ? "No subscribers match this yet." : <>Goes to <b className="text-ink">{count.toLocaleString("en-IN")}</b> {count === 1 ? "person" : "people"}.</>}
        </p>
        <Field label="Subject">
          <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required className={inputClass} placeholder="My new Notion template is live" />
        </Field>
        <Field label="Message">
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={10000} required className={textareaClass} placeholder={"Hi,\n\nI just launched…"} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text (optional)">
            <input name="button_label" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={40} className={inputClass} placeholder="Get it now" />
          </Field>
          <Field label="Button link">
            <input name="button_url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} className={inputClass} placeholder="https://" />
          </Field>
        </div>
        {livePages.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Link a product:
            {livePages.slice(0, 6).map((p) => (
              <button key={p.id} type="button" onClick={() => { setButtonUrl(`${appUrl}/p/${p.slug}`); if (!buttonLabel) setButtonLabel("Get it now"); }} className="rounded-full bg-surface-strong px-3 py-1 text-ink">
                {p.title}
              </button>
            ))}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" formAction={testAction} variant="secondary" loading={testing} disabled={testing || sending}>{testing ? "Sending test" : "Send me a test"}</Button>
          <Button
            type="submit"
            loading={sending}
            disabled={sending || testing || !count}
            onClick={(e) => { if (!confirm(`Send "${subject || "this email"}" to ${count ?? 0} people now? This can't be undone.`)) e.preventDefault(); }}
          >
            {sending ? "Sending" : `Send to ${(count ?? 0).toLocaleString("en-IN")} ${count === 1 ? "person" : "people"}`}
          </Button>
        </div>
        <FormMessage state={sendState ?? testState} />
      </div>

      <div className="space-y-2">
        <p className="text-[13px] text-muted">Preview · from “{creatorName} via Reviewlabs”</p>
        <div className={cx("overflow-hidden rounded-3xl border border-hairline bg-surface-soft")}>
          <p className="border-b border-hairline bg-canvas px-5 py-3 text-[15px] font-semibold">{subject || "Subject"}</p>
          <iframe title="Email preview" srcDoc={preview} className="h-[560px] w-full bg-[#f7f7f7]" sandbox="" />
        </div>
      </div>
    </form>
  );
}
