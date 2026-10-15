"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cx, inputClass, textareaClass } from "@/components/ui";
import { getMetaCookies, initPixel, newEventId, trackPixel } from "@/components/meta-pixel";
import { COVER_PRESETS, type LeadFormData } from "@/lib/lead-magnets";

type Done = { token: string; responseId: string };
type FileItem = { id: string; file_name: string; size_bytes: number };

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const label = "mb-1.5 block text-[14px] font-medium text-ink";
const star = <span className="text-down"> *</span>;

// The lead magnet form. `preview` renders the same card inert for the builder.
export function LeadMagnetCard({ data, files = [], preview, previewDone, pixelId, compact }: { data: LeadFormData; files?: FileItem[]; preview?: boolean; previewDone?: boolean; pixelId?: string | null; compact?: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (preview) return;
    void fetch("/api/leads/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ magnetId: data.id }), keepalive: true }).catch(() => {});
    if (pixelId) void initPixel(pixelId).then(() => trackPixel(pixelId, "PageView", {}, newEventId("pv")));
  }, [preview, data.id, pixelId]);

  async function sendCode() {
    const res = await fetch("/api/leads/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ magnetId: data.id, email: form.email }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) throw new Error(json.error ?? "Couldn't send the code. Please try again.");
  }

  async function submit(withCode?: string) {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ magnetId: data.id, ...form, answers, code: withCode, sourceUrl: window.location.href, ...getMetaCookies() }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.status === 409 && json.needsCode) {
      await sendCode();
      setStep("code");
      return;
    }
    if (!res?.ok || !json.token) throw new Error(json.error ?? "Something went wrong. Please try again.");
    if (!json.repeat) trackPixel(pixelId ?? null, "Lead", { content_name: data.title, content_ids: [data.id], value: 0, currency: "INR" }, `lead_${json.responseId}`);
    setDone({ token: json.token, responseId: json.responseId });
    setStep("done");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (step === "code") await submit(code);
      else if (data.verifyEmail) {
        await sendCode();
        setStep("code");
      } else await submit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "done" || !data.redirectUrl || preview) return;
    const t = setTimeout(() => window.location.assign(data.redirectUrl!), files.length ? 8000 : 3000);
    return () => clearTimeout(t);
  }, [step, data.redirectUrl, preview, files.length]);

  const cover = data.coverImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.coverImageUrl} alt="" className="aspect-[2/1] w-full object-cover" />
  ) : (
    <div className="aspect-[2/1] w-full" style={{ background: COVER_PRESETS[data.coverPreset] }} />
  );

  return (
    <div className={cx("w-full overflow-hidden rounded-3xl bg-canvas shadow-[0_24px_60px_rgba(10,11,13,0.25)]", compact ? "max-w-[360px]" : "max-w-[440px]")}>
      {cover}
      <div className={compact ? "p-5" : "p-6 sm:p-8"}>
        {step === "done" || (preview && previewDone) ? (
          <div className="space-y-5">
            <div className="flex size-12 items-center justify-center rounded-full bg-up text-white">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path d="m5 12 5 5 9-10" /></svg>
            </div>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight">You&apos;re in!</h1>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">{data.thankYouMessage}</p>
            </div>
            {files.length > 0 && (done || preview) && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-hairline p-3">
                    <span className="min-w-0 break-all text-[14px]">{f.file_name} <span className="num text-[12px] text-muted">{size(f.size_bytes)}</span></span>
                    <a href={done ? `/api/leads/download/${done.token}/${f.id}` : undefined} className="shrink-0 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">Download</a>
                  </li>
                ))}
              </ul>
            )}
            {files.length > 0 && <p className="text-[13px] text-muted">We&apos;ve also emailed the download link to {form.email || "their inbox"}.</p>}
            {data.redirectUrl && (
              <a href={preview ? undefined : data.redirectUrl} className="flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">Continue</a>
            )}
            {data.recommended && (
              <div className="border-t border-hairline pt-5">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">You might also like</p>
                <Link href={`/p/${data.recommended.slug}`} onClick={(e) => preview && e.preventDefault()} className="mt-2 flex items-center gap-3 rounded-2xl border border-hairline p-3 transition hover:border-primary">
                  {data.recommended.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.recommended.cover} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="size-12 shrink-0 rounded-xl" style={{ background: COVER_PRESETS.ocean }} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{data.recommended.title}</span>
                  <span className="num shrink-0 text-[14px]">{data.recommended.price}</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h1 className={cx("font-semibold leading-tight", compact ? "text-[18px]" : "text-[22px]")}>{data.title || "Your lead magnet title"}</h1>
              {data.description && <p className="mt-1.5 text-[14px] leading-relaxed text-body">{data.description}</p>}
            </div>

            {step === "code" ? (
              <div>
                <p className="text-[14px] text-body">We sent a 6-digit code to <b className="text-ink">{form.email}</b>.</p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="123456"
                  className={cx(inputClass, "num mt-3 text-center text-[22px] tracking-[0.4em]")}
                  aria-label="Verification code"
                />
                <div className="mt-2 flex justify-between text-[13px]">
                  <button type="button" className="link" onClick={() => { setStep("form"); setCode(""); setError(null); }}>Change email</button>
                  <button type="button" className="link" disabled={busy} onClick={() => { setError(null); void sendCode().catch((e) => setError(e.message)); }}>Send a new code</button>
                </div>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className={label}>What&apos;s your name?{star}</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} autoComplete="name" className={inputClass} disabled={preview} />
                </label>
                <label className="block">
                  <span className={label}>Your email{star}</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={200} autoComplete="email" className={inputClass} disabled={preview} />
                </label>
                {data.collectPhone && (
                  <label className="block">
                    <span className={label}>Phone number{data.phoneRequired && star}</span>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required={data.phoneRequired} autoComplete="tel" placeholder="98765 43210" className={inputClass} disabled={preview} />
                  </label>
                )}
                {data.questions.map((q) => (
                  <label key={q.id} className="block">
                    <span className={label}>{q.label || "Untitled question"}{q.required && star}</span>
                    {q.type === "textarea" ? (
                      <textarea rows={3} required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={textareaClass} disabled={preview} />
                    ) : q.type === "select" ? (
                      <select required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={inputClass} disabled={preview}>
                        <option value="">Select</option>
                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={q.type === "number" ? "number" : "text"} required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={inputClass} disabled={preview} />
                    )}
                  </label>
                ))}
                {/* Honeypot: hidden from people, filled by bots. */}
                <input tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden name="company" />
              </>
            )}

            {error && <p className="text-[14px] font-medium text-down">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition hover:bg-[#282b31] disabled:opacity-60">
              {busy ? "Please wait" : step === "code" ? "Verify and continue" : data.buttonLabel || "Get it now"}
            </button>
            <p className="text-center text-[12px] text-muted">
              By continuing, you agree to receive updates from {data.creatorName || "the creator"}.
              {data.fileCount > 0 && step === "form" && " You'll get the download right away."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
