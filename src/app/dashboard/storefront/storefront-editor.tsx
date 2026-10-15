"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { checkHandle, movePage, saveStorefront, setPageVisible } from "./actions";
import { ProfilePhoto, StorefrontView, type StorefrontData } from "@/components/storefront-view";
import { Button, Field, FormMessage, Panel, inputClass, textareaClass, cx } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { createClient } from "@/lib/supabase/client";
import { avatarBlob } from "@/lib/avatar-blob";
import { formatPaise } from "@/lib/money";
import { SOCIALS } from "@/lib/storefront";

type PageRow = { id: string; slug: string; title: string; amountPaise: number; isFree: boolean; cover: string | null; live: boolean; visible: boolean };
type Initial = { handle: string; name: string; bio: string; avatarUrl: string; socials: Record<string, string>; featuredId: string };

export function StorefrontEditor({ appUrl, creatorId, showBranding, initial, pages }: { appUrl: string; creatorId: string; showBranding: boolean; initial: Initial; pages: PageRow[] }) {
  const [state, action, saving] = useActionState(saveStorefront, null);
  const [draft, setDraft] = useState(initial);
  const [handleStatus, setHandleStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const savedHandle = initial.handle;
  const link = savedHandle ? `${appUrl.replace(/^https?:\/\//, "")}/@${savedHandle}` : null;

  // Debounced availability check for the link name.
  useEffect(() => {
    const h = draft.handle.trim().toLowerCase();
    if (!h || h === savedHandle) return;
    const t = setTimeout(() => void checkHandle(h).then(setHandleStatus), 400);
    return () => clearTimeout(t);
  }, [draft.handle, savedHandle]);
  const status = !draft.handle.trim() || draft.handle.trim().toLowerCase() === savedHandle ? null : handleStatus;

  async function onPhoto(file: File) {
    setPhotoError(null);
    if (!file.type.startsWith("image/")) return setPhotoError("Choose an image file.");
    setUploading(true);
    try {
      const blob = await avatarBlob(file, 400);
      const path = `${creatorId}/avatars/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("page-covers").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      set("avatarUrl", supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const live = pages.filter((p) => p.live);
  const preview: StorefrontData = {
    name: draft.name,
    handle: draft.handle.trim().toLowerCase(),
    bio: draft.bio,
    avatarUrl: draft.avatarUrl || null,
    socials: draft.socials,
    featuredId: draft.featuredId || null,
    showBranding,
    products: live.filter((p) => p.visible).map(({ id, slug, title, amountPaise, isFree, cover }) => ({ id, slug, title, amountPaise, isFree, cover })),
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        {link && (
          <Panel title="Your storefront link" aside={<CopyButton value={`${appUrl}/@${savedHandle}`} label="Copy link" />}>
            <a href={`/@${savedHandle}`} target="_blank" rel="noreferrer" className="link num break-all text-[17px] font-semibold">{link}</a>
            <p className="mt-1 text-[13px] text-muted">Put this in your Instagram, YouTube and WhatsApp bio.</p>
          </Panel>
        )}

        <Panel title="Profile">
          <form action={action} className="space-y-5">
            <Field label="Your link name" hint={`Your storefront will be at ${appUrl.replace(/^https?:\/\//, "")}/@${draft.handle.trim().toLowerCase() || "yourname"}`}>
              <div className="flex items-center rounded-xl border border-hairline bg-canvas focus-within:border-primary">
                <span className="pl-4 text-[15px] text-muted">@</span>
                <input
                  name="handle"
                  value={draft.handle}
                  onChange={(e) => set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  maxLength={30}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="yourname"
                  className="h-12 w-full bg-transparent pl-1 pr-4 text-[15px] outline-none"
                />
              </div>
              {status && <p className={cx("mt-1.5 text-[13px]", status.ok ? "text-up" : "text-down")}>{status.message}</p>}
            </Field>

            <div className="flex items-center gap-4">
              <ProfilePhoto url={draft.avatarUrl || null} name={draft.name || draft.handle} size={72} />
              <div className="space-y-1">
                <label className={cx("inline-flex cursor-pointer items-center rounded-full bg-surface-strong px-4 py-2 text-[14px] font-semibold", uploading && "opacity-60")}>
                  {uploading ? "Uploading" : draft.avatarUrl ? "Change photo" : "Upload photo"}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
                </label>
                {draft.avatarUrl && <button type="button" onClick={() => set("avatarUrl", "")} className="link ml-3 text-[13px]">Remove</button>}
                {photoError && <p className="text-[13px] text-down">{photoError}</p>}
              </div>
              <input type="hidden" name="avatar_url" value={draft.avatarUrl} />
            </div>

            <Field label="Display name">
              <input name="name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className={inputClass} placeholder="Your name or brand" />
            </Field>
            <Field label="Bio" hint={`${draft.bio.length}/160`}>
              <textarea name="bio" value={draft.bio} onChange={(e) => set("bio", e.target.value.slice(0, 160))} rows={3} className={textareaClass} placeholder="What you do, in a line or two" />
            </Field>

            <div>
              <p className="text-[14px] font-semibold">Social links</p>
              <p className="text-[13px] text-muted">Fill only the ones you use.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SOCIALS.map((s) => (
                  <label key={s.key} className="block">
                    <span className="mb-1 block text-[13px] text-body">{s.label}</span>
                    <input
                      name={`social_${s.key}`}
                      value={draft.socials[s.key] ?? ""}
                      onChange={(e) => set("socials", { ...draft.socials, [s.key]: e.target.value })}
                      placeholder={s.placeholder}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>

            <Field label="Featured product" hint="Shown large at the top of your storefront.">
              <select name="featured_page_id" value={draft.featuredId} onChange={(e) => set("featuredId", e.target.value)} className={inputClass}>
                <option value="">None</option>
                {live.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>

            <FormMessage state={state} />
            <Button type="submit" disabled={saving || uploading || status?.ok === false}>{saving ? "Saving" : "Save storefront"}</Button>
          </form>
        </Panel>

        <Panel title="Products on your storefront">
          <p className="text-[14px] text-muted">Choose what shows and in what order. Only live pages appear publicly.</p>
          <ul className={cx("mt-4 divide-y divide-hairline", pending && "opacity-60")}>
            {pages.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="flex flex-col">
                  <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => startTransition(() => movePage(p.id, "up"))} className="px-1 text-muted disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Move down" disabled={i === pages.length - 1 || pending} onClick={() => startTransition(() => movePage(p.id, "down"))} className="px-1 text-muted disabled:opacity-30">▼</button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{p.title}</p>
                  <p className="text-[13px] text-muted">
                    {p.isFree ? "Free" : formatPaise(p.amountPaise)} · {p.live ? "Live" : "Draft (not shown)"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={p.visible} disabled={pending} onChange={(e) => startTransition(() => setPageVisible(p.id, e.target.checked))} className="size-4 accent-[#0052ff]" />
                  Show
                </label>
              </li>
            ))}
            {!pages.length && <li className="py-3 text-[14px] text-muted">Create a product page first.</li>}
          </ul>
        </Panel>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Live preview</p>
        <div className="max-h-[80vh] overflow-y-auto rounded-[32px] border-8 border-ink bg-[radial-gradient(ellipse_at_top,#eef3ff_0%,#f7f7f7_45%)]">
          <StorefrontView data={preview} preview />
        </div>
      </div>
    </div>
  );
}
