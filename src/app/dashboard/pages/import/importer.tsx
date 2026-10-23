"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button, FormMessage, buttonClass, cx } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { importPayloadSchema, planImport, type ImportPayload } from "@/lib/superprofile-import";
import { SaveSteps } from "@/components/import-guide";
import { importFromSuperprofile, type ImportResult } from "./actions";

const SUPERPROFILE = "https://superprofile.bio";

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
    s.src = `/superprofile-import.js?v=2`;
    s.onload = () => (window.__reviewlabsSuperprofile ? resolve(window.__reviewlabsSuperprofile) : reject(new Error("load")));
    s.onerror = () => reject(new Error("load"));
    document.body.appendChild(s);
  });
}

export function Importer({ creatorPlan }: { creatorPlan: boolean }) {
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  if (payload) return <Preview payload={payload} creatorPlan={creatorPlan} onReset={() => { setPayload(null); setReadError(null); }} />;

  return (
    <div className="space-y-6">
      {readError && <p role="alert" className="rounded-2xl bg-down/10 p-4 text-[14px] font-medium text-down">{readError}</p>}
      <FileImport onData={setPayload} onError={setReadError} />
      <p className="text-[13px] text-muted">
        Only import pages you own. We copy the text, prices, images, testimonials, FAQs, add-on offer and policies. Your files,
        buyers and sales stay on Superprofile, and we never see your Superprofile login.{" "}
        <Link href="/import" target="_blank" className="link">Full step-by-step guide</Link>
      </p>
    </div>
  );
}

// Saves we can't read, with what to do instead.
function wrongFormat(name: string): string | null {
  if (/\.webarchive$/i.test(name)) return "That's a Safari Web Archive. Save the page again with File → Save As…, set Format to Page Source, and upload that .html file.";
  if (/\.mht(ml)?$/i.test(name)) return "That's a single-file (.mhtml) save, which leaves out the product details. Save the page again as \"Webpage, Complete\" and upload the .html file.";
  if (/\.(zip|rar|7z)$/i.test(name)) return "Upload the .html file itself, not a zip.";
  if (!/\.html?$/i.test(name)) return "Please upload the .html file your browser saved. The guide below shows how.";
  return null;
}

function FileImport({ onData, onError }: { onData: (p: ImportPayload) => void; onError: (e: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  async function onFile(file: File | undefined) {
    if (!file) return;
    onError(null);
    const format = wrongFormat(file.name);
    if (format) return onError(format);
    if (file.size > 15 * 1024 * 1024) return onError("That file is too big for a saved web page. Save the page again (Ctrl+S / Cmd+S) and upload the .html file.");
    setBusy(true);
    try {
      const [html, picker] = await Promise.all([file.text(), loadPicker()]);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const canonical = doc.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "";
      const result = picker.pick(doc, canonical.startsWith(SUPERPROFILE) ? canonical : "");
      if (result.error) {
        onError("That file isn't a saved Superprofile product page. Open the product page itself (superprofile.bio/vp/…), save it as shown below, and upload the .html file.");
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
    <div className="space-y-6 rounded-3xl border border-hairline bg-canvas p-6 sm:p-8">
      <Step n={1} title="Save your Superprofile page as a .html file">
        <SaveSteps className="mt-3" />
      </Step>
      <Step n={2} title="Upload the .html file">
        <label
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
          className={cx(
            "mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            over ? "border-primary bg-primary-soft" : "border-hairline hover:border-primary/50",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <span className={cx(buttonClass.secondary, "h-11 px-5")}>{busy ? "Reading…" : "Choose .html file"}</span>
          <span className="text-[13px] text-muted">or drop it here</span>
          <input type="file" accept=".html,.htm,text/html" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} disabled={busy} />
        </label>
      </Step>
      <Step n={3} title="Check what we found, then create your draft">
        <p>Nothing goes live. You get a draft page to finish: upload your file, check the price, and publish when you&apos;re ready.</p>
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
