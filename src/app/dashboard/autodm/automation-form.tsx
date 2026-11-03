"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormMessage, Panel, cx, inputClass, textareaClass } from "@/components/ui";
import { MAX_DM_LENGTH } from "@/lib/autodm";
import { saveAutomation } from "./actions";

export type MediaOption = { id: string; thumb?: string; caption?: string };
export type AutomationDraft = {
  id?: string;
  name: string;
  active: boolean;
  postScope: "all" | "selected";
  media: MediaOption[];
  matchMode: "keywords" | "any";
  keywords: string;
  dmMessage: string;
  linkKind: "none" | "page" | "url";
  pageId: string;
  linkUrl: string;
  publicReplyEnabled: boolean;
  publicReplies: string[];
};

export const emptyDraft: AutomationDraft = {
  name: "",
  active: true,
  postScope: "selected",
  media: [],
  matchMode: "keywords",
  keywords: "",
  dmMessage: "Hey! Thanks for your comment. Here's the link you asked for 👇",
  linkKind: "page",
  pageId: "",
  linkUrl: "",
  publicReplyEnabled: true,
  publicReplies: ["Sent you a DM 📩", "Check your DMs!", "Done, check your inbox ✅"],
};

function Choice({ checked, onSelect, title, children }: { checked: boolean; onSelect: () => void; title: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={cx("rounded-2xl border px-4 py-3 text-left transition", checked ? "border-2 border-primary bg-primary-soft px-[15px] py-[11px]" : "border-hairline bg-canvas")}
    >
      <span className="block text-[15px] font-semibold">{title}</span>
      {children && <span className="mt-0.5 block text-[13px] text-body">{children}</span>}
    </button>
  );
}

export function AutomationForm({ draft, media, mediaError, pages }: { draft: AutomationDraft; media: MediaOption[]; mediaError: string | null; pages: { id: string; title: string; status: string }[] }) {
  const [state, action, pending] = useActionState(saveAutomation, null);
  const [scope, setScope] = useState(draft.postScope);
  const [picked, setPicked] = useState<MediaOption[]>(draft.media);
  const [mode, setMode] = useState(draft.matchMode);
  const [linkKind, setLinkKind] = useState(draft.linkKind);
  const [message, setMessage] = useState(draft.dmMessage);
  const [publicOn, setPublicOn] = useState(draft.publicReplyEnabled);
  // Posts chosen earlier that are no longer in the latest 24 still show.
  const options = [...media, ...draft.media.filter((d) => !media.some((m) => m.id === d.id))];
  const toggle = (m: MediaOption) => setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : [...p, m]));

  return (
    <form action={action} className="grid gap-6">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <input type="hidden" name="post_scope" value={scope} />
      <input type="hidden" name="match_mode" value={mode} />
      <input type="hidden" name="link_kind" value={linkKind} />
      <input type="hidden" name="media" value={JSON.stringify(picked)} />

      <Panel title="1. Name">
        <Field label="Automation name" hint="Only you see this.">
          <input name="name" required maxLength={80} defaultValue={draft.name} placeholder="Free PDF reel" className={inputClass} />
        </Field>
      </Panel>

      <Panel title="2. Which posts">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice checked={scope === "selected"} onSelect={() => setScope("selected")} title="Specific posts or reels">Only the ones you pick below</Choice>
          <Choice checked={scope === "all"} onSelect={() => setScope("all")} title="Any post or reel">Including ones you post later</Choice>
        </div>
        {scope === "selected" && (
          <div className="mt-4">
            {mediaError && <p className="mb-3 text-[14px] text-down">{mediaError}</p>}
            {!options.length ? (
              <p className="text-[14px] text-body">No posts found on your account yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {options.map((m) => {
                  const on = picked.some((p) => p.id === m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m)} aria-pressed={on} title={m.caption} className={cx("relative aspect-square overflow-hidden rounded-xl bg-surface-strong ring-offset-2 transition", on && "ring-2 ring-primary")}>
                      {m.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumb} alt={m.caption ?? "Instagram post"} className="size-full object-cover" />
                      ) : (
                        <span className="p-2 text-[11px] text-body">{m.caption?.slice(0, 60) || "Post"}</span>
                      )}
                      {on && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-[13px] font-bold text-white">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[13px] text-muted">{picked.length} selected</p>
          </div>
        )}
      </Panel>

      <Panel title="3. When someone comments">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice checked={mode === "keywords"} onSelect={() => setMode("keywords")} title="A keyword">e.g. &quot;PDF&quot; or &quot;guide&quot;</Choice>
          <Choice checked={mode === "any"} onSelect={() => setMode("any")} title="Anything">Every comment gets the DM</Choice>
        </div>
        {mode === "keywords" && (
          <div className="mt-4">
            <Field label="Keywords" hint="Separate with commas. Not case sensitive; whole words only, so PDF doesn't match PDFs.">
              <input name="keywords" defaultValue={draft.keywords} placeholder="PDF, guide, link" className={inputClass} />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="4. The DM they get">
        <Field label="Message" hint={`${message.length}/${MAX_DM_LENGTH}. Your link is added on its own line at the end.`}>
          <textarea name="dm_message" required rows={4} maxLength={MAX_DM_LENGTH} value={message} onChange={(e) => setMessage(e.target.value)} className={textareaClass} />
        </Field>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Choice checked={linkKind === "page"} onSelect={() => setLinkKind("page")} title="One of my products" />
          <Choice checked={linkKind === "url"} onSelect={() => setLinkKind("url")} title="Another link" />
          <Choice checked={linkKind === "none"} onSelect={() => setLinkKind("none")} title="No link" />
        </div>
        {linkKind === "page" && (
          <div className="mt-4">
            <Field label="Product" hint="Only live products work; a paused product sends the DM without a link.">
              <select name="page_id" defaultValue={draft.pageId} className={inputClass}>
                <option value="">Choose a product</option>
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status !== "live" ? " (draft)" : ""}</option>)}
              </select>
            </Field>
          </div>
        )}
        {linkKind === "url" && (
          <div className="mt-4">
            <Field label="Link" hint="Any https link: your storefront, a YouTube video, a Google Form.">
              <input name="link_url" defaultValue={draft.linkUrl} placeholder="https://" className={inputClass} />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="5. Public reply (optional)">
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" name="public_reply_enabled" checked={publicOn} onChange={(e) => setPublicOn(e.target.checked)} className="size-5 accent-primary" />
          Also reply under the comment, so others see it works
        </label>
        {publicOn && (
          <div className="mt-4 grid gap-3">
            {[0, 1, 2].map((i) => (
              <input key={i} name="public_reply" maxLength={200} defaultValue={draft.publicReplies[i] ?? ""} placeholder={i === 0 ? "Sent you a DM 📩" : "Another variation (optional)"} className={inputClass} />
            ))}
            <p className="text-[13px] text-muted">We rotate between these. Varied replies look less like a bot to Instagram.</p>
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" name="active" defaultChecked={draft.active} className="size-5 accent-primary" />
          Turn on now
        </label>
        <Button type="submit" loading={pending} disabled={pending}>{pending ? "Saving" : draft.id ? "Save changes" : "Create automation"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
