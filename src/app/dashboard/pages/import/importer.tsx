"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button, FormMessage, buttonClass, cx } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { importPayloadSchema, planImport, type ImportPayload } from "@/lib/superprofile-import";
import { importFromSuperprofile, type ImportResult } from "./actions";

const SUPERPROFILE = "https://superprofile.bio";
const WINDOW_NAME = "reviewlabs_import";

type Picker = { pick: (doc: Document, url: string) => (ImportPayload & { error?: undefined }) | { error: string } };
declare global {
  interface Window {
    __reviewlabsSuperprofile?: Picker;
  }
}

function loadPicker(): Promise<Picker> {
  if (window.__reviewlabsSuperprofile) return Promise.resolve(window.__reviewlabsSuperprofile);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `/superprofile-import.js?v=1`;
    s.onload = () => (window.__reviewlabsSuperprofile ? resolve(window.__reviewlabsSuperprofile) : reject(new Error("load")));
    s.onerror = () => reject(new Error("load"));
    document.body.appendChild(s);
  });
}

function bookmarkletCode(origin: string) {
  return `javascript:(function(){window.__rlWin=window.open('${origin}/dashboard/pages/import','${WINDOW_NAME}');var s=document.createElement('script');s.src='${origin}/superprofile-import.js?t='+Date.now();s.setAttribute('data-mode','bookmarklet');document.body.appendChild(s);})();`;
}

export function Importer({ creatorPlan }: { creatorPlan: boolean }) {
  const [tab, setTab] = useState<"bookmarklet" | "file">("bookmarklet");
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  // True in the tab the bookmarklet opened (it names the window), false on the server.
  const fromBookmarklet = useSyncExternalStore(
    () => () => {},
    () => window.name === WINDOW_NAME && Boolean(window.opener),
    () => false,
  );
  const [answered, setAnswered] = useState(false);
  const waiting = fromBookmarklet && !answered;

  // Opened by the bookmarklet: ask the Superprofile tab for the page data.
  useEffect(() => {
    if (!fromBookmarklet) return;
    const opener = window.opener as Window;
    let done = false;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SUPERPROFILE || event.source !== opener) return;
      if (event.data?.type !== "reviewlabs-import-data") return;
      done = true;
      setAnswered(true);
      const parsed = importPayloadSchema.safeParse(event.data.payload);
      if (parsed.success) setPayload(parsed.data);
      else setReadError("We couldn't read that page. Open the product page itself on superprofile.bio and click Import again.");
    };
    window.addEventListener("message", onMessage);
    const ask = () => {
      try {
        opener.postMessage({ type: "reviewlabs-import-ready" }, SUPERPROFILE);
      } catch {
        // The Superprofile tab was closed or navigated away.
      }
    };
    ask();
    const timer = setInterval(() => (done ? clearInterval(timer) : ask()), 800);
    const giveUp = setTimeout(() => {
      if (!done) {
        setAnswered(true);
        setReadError("We didn't hear back from your Superprofile tab. Keep it open, then click \"Import to Reviewlabs\" on it again.");
      }
    }, 15000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      clearTimeout(giveUp);
    };
  }, [fromBookmarklet]);

  if (payload) return <Preview payload={payload} creatorPlan={creatorPlan} onReset={() => { setPayload(null); setReadError(null); }} />;

  if (waiting) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-hairline bg-canvas p-8 text-[16px]">
        <span className="spinner" aria-hidden /> Reading your Superprofile page…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {readError && <p className="rounded-2xl bg-down/10 p-4 text-[14px] font-medium text-down">{readError}</p>}
      <div className="flex rounded-full bg-surface-strong p-1 sm:inline-flex" role="tablist" aria-label="Import method">
        {([["bookmarklet", "One-click import"], ["file", "Upload a saved page"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx("flex-1 rounded-full px-4 py-2 text-[14px] font-semibold sm:flex-none", tab === key ? "bg-canvas text-ink shadow-soft" : "text-body")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "bookmarklet" ? <BookmarkletSteps /> : <FileImport onData={setPayload} onError={setReadError} />}
      <p className="text-[13px] text-muted">
        Only import pages you own. We copy the text, prices, images, testimonials, FAQs, add-on offer and policies. Your files,
        buyers and sales stay on Superprofile, and we never see your Superprofile login.
      </p>
    </div>
  );
}

function BookmarkletSteps() {
  const link = useRef<HTMLAnchorElement>(null);
  // React blocks javascript: links in JSX, so the bookmarklet is set after mount.
  useEffect(() => {
    link.current?.setAttribute("href", bookmarkletCode(window.location.origin));
  }, []);
  return (
    <div className="space-y-5 rounded-3xl border border-hairline bg-canvas p-6 sm:p-8">
      <Step n={1} title="Add the import button to your browser">
        <p>Drag this button to your bookmarks bar. You only do this once. (No bookmarks bar? Press Ctrl+Shift+B, or Cmd+Shift+B on a Mac.)</p>
        <a
          ref={link}
          href="#"
          onClick={(e) => e.preventDefault()}
          draggable
          className={cx(buttonClass.primary, "mt-3 h-11 cursor-grab px-5 active:cursor-grabbing")}
          title="Drag me to your bookmarks bar"
        >
          ⇪ Import to Reviewlabs
        </a>
      </Step>
      <Step n={2} title="Open your product page on Superprofile">
        <p>Go to the page you want to bring over, for example <span className="num">superprofile.bio/vp/your-product</span>, and let it load.</p>
      </Step>
      <Step n={3} title="Click “Import to Reviewlabs” in your bookmarks">
        <p>A Reviewlabs tab opens with everything we found. Check it, then create your draft page.</p>
      </Step>
      <p className="text-[13px] text-muted">Works in Chrome, Edge, Firefox and Safari on a computer. On a phone, use “Upload a saved page” instead.</p>
    </div>
  );
}

function FileImport({ onData, onError }: { onData: (p: ImportPayload) => void; onError: (e: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  async function onFile(file: File | undefined) {
    if (!file) return;
    onError(null);
    if (file.size > 15 * 1024 * 1024) return onError("That file is too big. Save just the web page (Ctrl+S / Cmd+S), not a video or archive.");
    setBusy(true);
    try {
      const [html, picker] = await Promise.all([file.text(), loadPicker()]);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const canonical = doc.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "";
      const result = picker.pick(doc, canonical.startsWith(SUPERPROFILE) ? canonical : "");
      if (result.error) {
        onError("That file isn't a saved Superprofile product page. Open your product page on superprofile.bio, press Ctrl+S (Cmd+S on a Mac), and upload the .html file it saves.");
      } else {
        const parsed = importPayloadSchema.safeParse(result);
        if (parsed.success) onData(parsed.data);
        else onError("We couldn't read that page. Try saving it again.");
      }
    } catch {
      onError("We couldn't open that file. Try saving the page again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 rounded-3xl border border-hairline bg-canvas p-6 sm:p-8">
      <Step n={1} title="Save your Superprofile page">
        <p>Open your product page on superprofile.bio, wait for it to load, then press <b>Ctrl+S</b> (<b>Cmd+S</b> on a Mac) and save it as a web page.</p>
      </Step>
      <Step n={2} title="Upload the .html file">
        <label className={cx(buttonClass.secondary, "mt-3 h-11 cursor-pointer px-5", busy && "pointer-events-none opacity-60")}>
          {busy ? "Reading…" : "Choose .html file"}
          <input type="file" accept=".html,.htm,text/html" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
        </label>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-semibold text-primary">{n}</span>
      <div className="min-w-0 text-[15px] text-body">
        <p className="mb-1 text-[16px] font-semibold text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Preview({ payload, creatorPlan, onReset }: { payload: ImportPayload; creatorPlan: boolean; onReset: () => void }) {
  const plan = useMemo(() => planImport(payload), [payload]);
  const [owns, setOwns] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  if (result && "pageId" in result) return <Done result={result} />;

  const rows: [string, string][] = [
    ["Price", plan.pricePaise ? `${formatPaise(plan.pricePaise)}${plan.compareAtPaise ? ` (was ${formatPaise(plan.compareAtPaise)})` : ""}` : "Not found, you'll set it"],
    ["Button text", plan.buttonLabel],
    ["Description", plan.descriptionHtml ? `${plan.descriptionHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length} words, ${(plan.descriptionHtml.match(/<img/g) ?? []).length} images` : "None"],
    ["Testimonials", String(plan.testimonials.length)],
    ["FAQs", String(plan.faqs.length)],
    ["Checkout questions", plan.fields.length ? plan.fields.map((f) => f.label).join(", ") : "None besides name, email and phone"],
    ["Add-on offer", plan.offer ? `${plan.offer.title} · ${formatPaise(plan.offer.pricePaise)}${creatorPlan ? "" : " (needs Creator plan, will be skipped)"}` : "None"],
    ["Refund policy and terms", plan.refundPolicy || plan.terms ? [plan.refundPolicy && "Refund policy", plan.terms && "Terms"].filter(Boolean).join(" and ") : "None"],
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-hairline bg-canvas">
        <div className="grid gap-0 md:grid-cols-[320px_1fr]">
          {payload.cover ? (
            // Preview only; the image is copied into your storage when you create the draft.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.cover} alt="" referrerPolicy="no-referrer" className="aspect-[16/10] w-full object-cover md:m-4 md:w-[calc(100%-2rem)] md:rounded-2xl" />
          ) : (
            <div className="aspect-[16/10] bg-surface-soft md:m-4 md:rounded-2xl" />
          )}
          <div className="p-6 sm:p-8">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">Found on Superprofile</p>
            <h2 className="display mt-2 text-[26px] leading-tight">{plan.title}</h2>
            <dl className="mt-5 divide-y divide-hairline-soft text-[14px]">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[150px_1fr] gap-3 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {plan.notes.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl bg-accent-yellow/15 p-4 text-[14px] text-ink">
          {plan.notes.map((n) => <li key={n}>• {n}</li>)}
        </ul>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-[15px]">
        <input type="checkbox" checked={owns} onChange={(e) => setOwns(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>This is my own Superprofile page, and I have the right to use its text, images and testimonials.</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="hero"
          loading={pending}
          disabled={!owns || pending}
          onClick={() => start(async () => setResult(await importFromSuperprofile(payload, owns)))}
        >
          {pending ? "Creating your draft" : "Create draft page"}
        </Button>
        <button type="button" onClick={onReset} className="link text-[14px]" disabled={pending}>Start over</button>
      </div>
      {pending && <p className="text-[14px] text-muted">Copying images and setting things up. This takes a few seconds.</p>}
      <FormMessage state={result && "error" in result ? { error: result.error } : null} />
    </div>
  );
}

function Done({ result }: { result: Extract<ImportResult, { pageId: string }> }) {
  const c = result.counts;
  const todo = [
    "Upload the file buyers get",
    result.priceSet ? "Check the price" : "Set the price (we couldn't read it)",
    ...(c.offer ? ["Upload the add-on offer's file and switch it on"] : []),
    "Look over the page in the preview, then set it to Live",
  ];
  return (
    <div className="space-y-6 rounded-3xl border border-hairline bg-canvas p-6 sm:p-8">
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-wider text-up">Draft created</p>
        <h2 className="display mt-2 text-[28px]">Your page is ready to finish.</h2>
        <p className="mt-2 text-[15px] text-body">
          Imported {c.testimonials} testimonial{c.testimonials === 1 ? "" : "s"}, {c.faqs} FAQ{c.faqs === 1 ? "" : "s"}, {c.images} image{c.images === 1 ? "" : "s"}
          {c.questions ? `, ${c.questions} checkout question${c.questions === 1 ? "" : "s"}` : ""}
          {c.offer ? ", the add-on offer" : ""}
          {c.policies ? " and your policies" : ""}. It stays a draft until you publish it.
        </p>
      </div>
      {result.notes.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl bg-accent-yellow/15 p-4 text-[14px] text-ink">
          {result.notes.map((n) => <li key={n}>• {n}</li>)}
        </ul>
      )}
      <div>
        <p className="mb-2 text-[15px] font-semibold">Before you publish</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-body">
          {todo.map((t) => <li key={t}>{t}</li>)}
        </ol>
      </div>
      <Link href={`/dashboard/pages/${result.pageId}`} className={cx(buttonClass.hero)}>Open the editor</Link>
    </div>
  );
}
