"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPageLink, deletePageLink } from "../../actions";
import { Button, FormMessage, cx, inputClass } from "@/components/ui";
import { MAX_LINKS, cleanLinkUrl, suggestLinkLabel } from "@/lib/product-links";

export type PageLink = { id: string; label: string; url: string };

// Links delivered after payment: Notion, Drive, Canva, course logins, group invites.
export function LinksManager({ pageId, links }: { pageId: string; links: PageLink[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const full = links.length >= MAX_LINKS;
  const clean = cleanLinkUrl(url);

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addPageLink({ pageId, label, url });
      setState(res);
      if (res?.ok) {
        setLabel("");
        setUrl("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {links.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl bg-surface-soft text-[14px]">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0">
                <span className="block font-medium">{l.label}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-muted hover:text-primary">{l.url}</a>
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => startDelete(async () => { await deletePageLink(l.id, pageId); router.refresh(); })}
                className="link shrink-0 text-[14px]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-[13px] text-muted">You&apos;ve added the maximum of {MAX_LINKS} links.</p>
      ) : (
        <form onSubmit={add} className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://notion.so/your-template"
            inputMode="url"
            autoComplete="off"
            aria-label="Link"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={clean ? suggestLinkLabel(clean) : "Name, e.g. Notion template"}
              maxLength={80}
              aria-label="Link name"
              className={cx(inputClass, "min-w-0 flex-1")}
            />
            <Button type="submit" variant="secondary" loading={pending} disabled={pending || !url.trim()}>Add link</Button>
          </div>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}
