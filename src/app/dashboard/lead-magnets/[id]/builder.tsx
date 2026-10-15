"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteLeadFile, deleteLeadMagnet, registerLeadFile, saveLeadBasics, saveLeadSettings } from "../actions";
import { LeadMagnetCard } from "@/components/lead-magnet-card";
import { cx, inputClass, textareaClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { COVER_KEYS, COVER_PRESETS, LEAD_LIMITS, QUESTION_TYPES, type CoverPreset, type LeadFile, type LeadFormData, type LeadMagnet, type LeadQuestion, type LeadQuestionType } from "@/lib/lead-magnets";

type Q = { id: string; label: string; type: LeadQuestionType; required: boolean; options: string[] };
type Product = { id: string; slug: string; title: string; price: string; cover: string | null };

const MAX_FILE = 50 * 1024 * 1024;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-up" : "bg-[#d5d8dd]")}>
      <span className={cx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className="num pointer-events-none absolute bottom-3 right-4 text-[12px] text-muted">{value.length}/{max}</span>;
}

function Section({ title, sub, aside, children }: { title: string; sub?: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="border-b-8 border-surface-soft py-7 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
        </div>
        {aside}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function LeadMagnetBuilder({ appUrl, creatorId, creatorName, magnet, questions, files, products }: {
  appUrl: string;
  creatorId: string;
  creatorName: string;
  magnet: LeadMagnet;
  questions: LeadQuestion[];
  files: LeadFile[];
  products: Product[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null);
  const [b, setB] = useState({
    title: magnet.title,
    description: magnet.description,
    buttonLabel: magnet.button_label,
    coverPreset: magnet.cover_preset,
    coverImageUrl: magnet.cover_image_url ?? "",
    collectPhone: magnet.collect_phone,
    phoneRequired: magnet.phone_required,
    verifyEmail: magnet.verify_email,
  });
  const [qs, setQs] = useState<Q[]>(questions.map((q) => ({ id: q.id, label: q.label, type: q.field_type, required: q.required, options: q.options })));
  const [withFiles, setWithFiles] = useState(files.length > 0);
  const [s, setS] = useState({
    slug: magnet.slug,
    thankYouMessage: magnet.thank_you_message,
    redirectUrl: magnet.redirect_url ?? "",
    recommendedPageId: magnet.recommended_page_id ?? "",
    storefrontVisible: magnet.storefront_visible,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const setBv = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => setB((x) => ({ ...x, [k]: v }));
  const setSv = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));
  const updateQ = (i: number, patch: Partial<Q>) => setQs((list) => list.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const rec = products.find((p) => p.id === s.recommendedPageId) ?? null;
  const preview: LeadFormData = {
    id: magnet.id,
    title: b.title,
    description: b.description,
    buttonLabel: b.buttonLabel,
    coverPreset: b.coverPreset,
    coverImageUrl: b.coverImageUrl || null,
    collectPhone: b.collectPhone,
    phoneRequired: b.phoneRequired,
    verifyEmail: b.verifyEmail,
    questions: qs,
    fileCount: files.length,
    creatorName,
    thankYouMessage: s.thankYouMessage,
    redirectUrl: s.redirectUrl || null,
    recommended: rec ? { slug: rec.slug, title: rec.title, price: rec.price, cover: rec.cover } : null,
  };

  async function onCover(file: File) {
    if (!file.type.startsWith("image/")) return setFileError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setFileError("Cover images can be up to 5 MB.");
    setUploading("cover");
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${creatorId}/lm-${magnet.id}-${Date.now()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("page-covers").upload(path, file, { contentType: file.type });
    if (error) setFileError(error.message);
    else setBv("coverImageUrl", supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    setUploading(null);
  }

  async function onFiles(list: File[]) {
    setFileError(null);
    const supabase = createClient();
    for (const file of list) {
      if (file.size > MAX_FILE) {
        setFileError(`${file.name} is larger than 50 MB`);
        continue;
      }
      setUploading(file.name);
      const path = `${creatorId}/lm/${magnet.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("product-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) {
        setFileError(`${file.name}: ${error.message}`);
        continue;
      }
      const res = await registerLeadFile({ magnetId: magnet.id, path, name: file.name, size: file.size, type: file.type || null });
      if (res?.error) setFileError(`${file.name}: ${res.error}`);
    }
    setUploading(null);
    // Keep Save disabled until the new file list has loaded.
    start(() => router.refresh());
  }

  function saveStep1() {
    setMessage(null);
    if (withFiles && !files.length) return setMessage({ error: "Upload at least one file, or switch off free resources." });
    start(async () => {
      const res = await saveLeadBasics({ id: magnet.id, ...b, questions: qs });
      setMessage(res);
      if (res?.ok) {
        setStep(2);
        setMessage(null);
        window.scrollTo({ top: 0 });
      }
    });
  }

  function saveStep2(status: "draft" | "live") {
    setMessage(null);
    start(async () => {
      const res = await saveLeadSettings({ id: magnet.id, ...s, status });
      setMessage(res);
      if (res?.ok) router.push(`/dashboard/lead-magnets?tab=${status === "live" ? "published" : "draft"}`);
    });
  }

  const shortUrl = `${appUrl.replace(/^https?:\/\//, "")}/l/${s.slug || "your-link"}`;

  return (
    <div className="-m-4 grid min-h-[calc(100vh-2rem)] sm:-m-6 lg:-m-8 lg:grid-cols-[minmax(0,560px)_1fr]">
      {/* Form */}
      <div className="flex flex-col bg-canvas">
        <header className="flex items-center gap-4 border-b border-hairline px-6 py-4">
          <Link href="/dashboard/lead-magnets" aria-label="Close" className="text-[22px] leading-none text-body hover:text-ink">×</Link>
          <span className="h-5 w-px bg-hairline" />
          <p className="flex-1 truncate text-[16px] font-semibold">{magnet.status === "live" ? "Edit lead magnet" : "New lead magnet"}</p>
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <span className={cx("size-1.5 rounded-full", step === 1 ? "bg-ink" : "bg-hairline")} />
            <span className={cx("size-1.5 rounded-full", step === 2 ? "bg-ink" : "bg-hairline")} />
            <span className="ml-1">Step {step} · {step === 1 ? "Basic information" : "After they submit"}</span>
          </span>
        </header>

        <div className="flex-1 px-6 py-7">
          {step === 1 ? (
            <>
              <Section title="Basic information">
                <p className="mb-2 text-[14px] font-medium">Cover{<span className="text-down"> *</span>}</p>
                <div className="rounded-2xl border border-dashed border-hairline p-4">
                  <div className="relative overflow-hidden rounded-xl">
                    {b.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.coverImageUrl} alt="" className="aspect-[2/1] w-full object-cover" />
                    ) : (
                      <div className="aspect-[2/1] w-full" style={{ background: COVER_PRESETS[b.coverPreset] }} />
                    )}
                    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
                      {COVER_KEYS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-label={`${k} cover`}
                          onClick={() => setB((x) => ({ ...x, coverPreset: k as CoverPreset, coverImageUrl: "" }))}
                          className={cx("size-9 rounded-full ring-2 transition", !b.coverImageUrl && b.coverPreset === k ? "ring-white" : "ring-white/30")}
                          style={{ background: COVER_PRESETS[k] }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-center gap-3">
                    <label className={cx("cursor-pointer rounded-full bg-surface-strong px-4 py-2 text-[14px] font-semibold", uploading === "cover" && "opacity-60")}>
                      {uploading === "cover" ? "Uploading" : "+ Add your own image"}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onCover(e.target.files[0])} />
                    </label>
                    {b.coverImageUrl && <button type="button" className="link text-[14px]" onClick={() => setBv("coverImageUrl", "")}>Use a gradient</button>}
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Title<span className="text-down"> *</span></span>
                  <span className="relative block">
                    <input value={b.title} maxLength={LEAD_LIMITS.title} onChange={(e) => setBv("title", e.target.value)} className={cx(inputClass, "pr-16")} placeholder="Get the 30-day trading checklist" />
                    <Counter value={b.title} max={LEAD_LIMITS.title} />
                  </span>
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Description</span>
                  <span className="relative block">
                    <textarea value={b.description} maxLength={LEAD_LIMITS.description} rows={2} onChange={(e) => setBv("description", e.target.value)} className={cx(textareaClass, "pb-7")} placeholder="One line on what they'll get" />
                    <Counter value={b.description} max={LEAD_LIMITS.description} />
                  </span>
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Button text<span className="text-down"> *</span></span>
                  <span className="relative block">
                    <input value={b.buttonLabel} maxLength={LEAD_LIMITS.button} onChange={(e) => setBv("buttonLabel", e.target.value)} className={cx(inputClass, "pr-16")} />
                    <Counter value={b.buttonLabel} max={LEAD_LIMITS.button} />
                  </span>
                </label>
              </Section>

              <Section title="Questions" sub="Name and email are always asked. Add anything else you want to know.">
                <ul className="divide-y divide-hairline rounded-2xl border border-hairline">
                  <li className="flex items-center gap-3 px-4 py-4">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#fde8e8] text-[13px] font-bold text-[#e5484d]">Tt</span>
                    <div className="flex-1"><p className="text-[15px]">What&apos;s your name? <span className="text-down">*</span></p><p className="text-[12px] text-muted">Text · always on</p></div>
                  </li>
                  <li className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#fde8f3] text-[#d6409f]">@</span>
                    <div className="flex-1"><p className="text-[15px]">Your email <span className="text-down">*</span></p><p className="text-[12px] text-muted">Email · always on</p></div>
                    <span className="flex items-center gap-2 rounded-xl border border-hairline px-3 py-1.5 text-[13px]">Verification code <Toggle label="Verify email with a code" checked={b.verifyEmail} onChange={(v) => setBv("verifyEmail", v)} /></span>
                  </li>
                  <li className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#e6efff] text-primary">☎</span>
                    <div className="flex-1"><p className={cx("text-[15px]", !b.collectPhone && "text-muted")}>Phone number {b.collectPhone && b.phoneRequired && <span className="text-down">*</span>}</p><p className="text-[12px] text-muted">{b.collectPhone ? "Shown" : "Hidden"}</p></div>
                    {b.collectPhone && (
                      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={b.phoneRequired} onChange={(e) => setBv("phoneRequired", e.target.checked)} className="size-4 accent-[#0052ff]" /> Required</label>
                    )}
                    <Toggle label="Ask for phone number" checked={b.collectPhone} onChange={(v) => setBv("collectPhone", v)} />
                  </li>
                  {qs.map((q, i) => (
                    <li
                      key={q.id}
                      draggable
                      onDragStart={() => (dragFrom.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragFrom.current;
                        dragFrom.current = null;
                        if (from === null || from === i) return;
                        setQs((list) => { const next = [...list]; const [moved] = next.splice(from, 1); next.splice(i, 0, moved); return next; });
                      }}
                      className="space-y-3 px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="cursor-grab select-none text-[18px] leading-none text-muted" title="Drag to reorder">⋮⋮</span>
                        <input value={q.label} onChange={(e) => updateQ(i, { label: e.target.value.slice(0, 120) })} placeholder="Your question" className={cx(inputClass, "flex-1")} />
                        <button type="button" aria-label="Delete question" onClick={() => setQs((list) => list.filter((_, j) => j !== i))} className="px-2 text-[20px] text-muted hover:text-down">×</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-8">
                        <select value={q.type} onChange={(e) => updateQ(i, { type: e.target.value as LeadQuestionType })} className={cx(inputClass, "h-10 w-auto")}>
                          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={q.required} onChange={(e) => updateQ(i, { required: e.target.checked })} className="size-4 accent-[#0052ff]" /> Required</label>
                      </div>
                      {q.type === "select" && (
                        <textarea
                          rows={3}
                          value={q.options.join("\n")}
                          onChange={(e) => updateQ(i, { options: e.target.value.split("\n").map((o) => o.slice(0, 80)).slice(0, 30) })}
                          onBlur={() => updateQ(i, { options: q.options.map((o) => o.trim()).filter(Boolean) })}
                          placeholder={"One option per line\nBeginner\nIntermediate"}
                          className={cx(textareaClass, "ml-8 w-[calc(100%-2rem)]")}
                        />
                      )}
                    </li>
                  ))}
                  <li className="px-4 py-3">
                    <button type="button" disabled={qs.length >= 15} onClick={() => setQs((list) => [...list, { id: crypto.randomUUID(), label: "", type: "text", required: false, options: [] }])} className="text-[15px] font-semibold hover:text-primary disabled:opacity-40">
                      + Add question
                    </button>
                  </li>
                </ul>
              </Section>

              <Section
                title="Want to include free resource(s)?"
                sub="Give people a file to download after they fill the form. It's also emailed to them."
                aside={<Toggle label="Include free files" checked={withFiles} onChange={setWithFiles} />}
              >
                {withFiles ? (
                  <div className="space-y-3">
                    {files.length > 0 && (
                      <ul className="divide-y divide-hairline rounded-2xl bg-surface-soft text-[14px]">
                        {files.map((f) => (
                          <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-3">
                            <span className="min-w-0 break-all">{f.file_name} <span className="num text-[12px] text-muted">{size(f.size_bytes)}</span></span>
                            <button type="button" className="link shrink-0" onClick={() => start(async () => { await deleteLeadFile(f.id, magnet.id); router.refresh(); })}>Remove</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-hairline p-6 text-center text-[14px] font-medium text-body transition hover:border-primary hover:text-primary">
                      {uploading && uploading !== "cover" ? `Uploading ${uploading}` : "Click to upload files (50 MB each)"}
                      <input type="file" multiple className="hidden" disabled={!!uploading} onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; void onFiles(l); }} />
                    </label>
                  </div>
                ) : null}
              </Section>
            </>
          ) : (
            <>
              <Section title="After they submit">
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-medium">Thank-you message<span className="text-down"> *</span></span>
                  <textarea rows={3} maxLength={LEAD_LIMITS.thankYou} value={s.thankYouMessage} onChange={(e) => setSv("thankYouMessage", e.target.value)} className={textareaClass} />
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Send them somewhere next <span className="font-normal text-muted">(optional)</span></span>
                  <input value={s.redirectUrl} onChange={(e) => setSv("redirectUrl", e.target.value.trim())} placeholder="https://chat.whatsapp.com/your-group" className={inputClass} />
                  <span className="mt-1 block text-[12px] text-muted">For example your WhatsApp group, Telegram channel or YouTube. They&apos;re taken there a few seconds after submitting.</span>
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Recommend a paid product <span className="font-normal text-muted">(optional)</span></span>
                  <select value={s.recommendedPageId} onChange={(e) => setSv("recommendedPageId", e.target.value)} className={inputClass}>
                    <option value="">None</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.price}</option>)}
                  </select>
                  <span className="mt-1 block text-[12px] text-muted">Shown on the thank-you screen. Only live product pages are listed.</span>
                </label>
              </Section>
              <Section title="Link and visibility">
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-medium">Link</span>
                  <span className="flex items-center rounded-xl border border-hairline bg-canvas focus-within:border-primary">
                    <span className="pl-4 text-[14px] text-muted">{appUrl.replace(/^https?:\/\//, "")}/l/</span>
                    <input value={s.slug} onChange={(e) => setSv("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={60} className="h-12 w-full bg-transparent pr-4 text-[15px] outline-none" />
                  </span>
                </label>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div><p className="text-[14px] font-medium">Show on my storefront</p><p className="text-[13px] text-muted">Listed on your link-in-bio page with a Free badge.</p></div>
                  <Toggle label="Show on storefront" checked={s.storefrontVisible} onChange={(v) => setSv("storefrontVisible", v)} />
                </div>
              </Section>
              <div className="pt-6">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { if (confirm("Delete this lead magnet? If it has responses it's archived so you keep the leads.")) start(() => deleteLeadMagnet(magnet.id)); }}
                  className="text-[14px] font-medium text-down"
                >
                  Delete lead magnet
                </button>
              </div>
            </>
          )}
        </div>

        {fileError && <p className="px-6 pb-3 text-[14px] text-down">{fileError}</p>}
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-hairline bg-canvas px-6 py-4">
          {message?.error && <p className="mr-auto text-[14px] font-medium text-down">{message.error}</p>}
          {step === 1 ? (
            <button type="button" disabled={pending || !!uploading} onClick={saveStep1} className="h-12 rounded-full bg-ink px-6 text-[15px] font-semibold text-white disabled:opacity-60">
              {pending && <span className="spinner mr-2 align-[-2px]" aria-hidden />}
              {pending ? "Saving" : "Save and continue"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setStep(1); setMessage(null); }} className="h-12 px-3 text-[15px] font-semibold text-body">Back</button>
              <button type="button" disabled={pending} onClick={() => saveStep2("draft")} className="h-12 rounded-full bg-surface-strong px-5 text-[15px] font-semibold disabled:opacity-60">Save as draft</button>
              <button type="button" disabled={pending} onClick={() => saveStep2("live")} className="h-12 rounded-full bg-ink px-6 text-[15px] font-semibold text-white disabled:opacity-60">
                {pending && <span className="spinner mr-2 align-[-2px]" aria-hidden />}
                {pending ? "Saving" : magnet.status === "live" ? "Save and publish" : "Publish"}
              </button>
            </>
          )}
        </footer>
      </div>

      {/* Preview */}
      <div className="hidden flex-col bg-[#18191c] bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] px-8 py-6 lg:flex">
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-semibold text-white">Preview</p>
          <select value={device} onChange={(e) => setDevice(e.target.value as "desktop" | "mobile")} className="h-10 rounded-xl border border-white/20 bg-transparent px-3 text-[14px] text-white">
            <option value="desktop" className="text-ink">Desktop</option>
            <option value="mobile" className="text-ink">Mobile</option>
          </select>
        </div>
        <div className="sticky top-6 mt-6 flex flex-1 items-start justify-center">
          {device === "desktop" ? (
            <div className="w-full max-w-[880px] overflow-hidden rounded-2xl border border-white/10 bg-[#2a2b2f] shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
                <span className="mx-auto max-w-sm flex-1 truncate rounded-md bg-white/10 px-3 py-1 text-center text-[11px] text-white/70">{shortUrl}</span>
              </div>
              <div className="flex max-h-[72vh] min-h-[560px] items-start justify-center overflow-y-auto px-6 py-10" style={{ background: COVER_PRESETS[b.coverPreset] }}>
                <LeadMagnetCard data={preview} files={files} preview previewDone={step === 2} compact />
              </div>
            </div>
          ) : (
            <div className="w-[340px] overflow-hidden rounded-[44px] border-[10px] border-black bg-black shadow-2xl">
              <div className="flex max-h-[72vh] min-h-[640px] items-start justify-center overflow-y-auto px-3 py-8" style={{ background: COVER_PRESETS[b.coverPreset] }}>
                <LeadMagnetCard data={preview} files={files} preview previewDone={step === 2} compact />
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-[12px] text-white/50">{step === 2 ? "Showing what people see after they submit." : "Showing the form."}</p>
      </div>
    </div>
  );
}
