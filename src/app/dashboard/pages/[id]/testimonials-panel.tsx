"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteTestimonial, moveTestimonial, saveTestimonial } from "./testimonial-actions";
import { FaceAvatar, randomFace, type Face } from "@/components/face-avatar";
import { Stars } from "@/components/testimonials-grid";
import { Button, Field, FormMessage, inputClass, textareaClass, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { avatarBlob } from "@/lib/avatar-blob";
import type { Testimonial } from "@/lib/types";

const MAX_COMMENT = 300;

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="transition active:scale-90"
        >
          <svg viewBox="0 0 24 24" width={34} height={34} aria-hidden>
            <path
              d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
              fill={n <= (hover || value) ? "#f5c542" : "#eef0f3"}
              stroke={n <= (hover || value) ? "#f5c542" : "#e5e7eb"}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

function TestimonialModal({ pageId, creatorId, editing, onClose }: { pageId: string; creatorId: string; editing: Testimonial | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveTestimonial, null);
  const [face, setFace] = useState<Face>(() => (editing?.avatar_face as Face) ?? randomFace());
  const [photo, setPhoto] = useState(editing?.avatar_url ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [rating, setRating] = useState(editing?.rating ?? 0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close once a save succeeds.
  const handled = useRef(false);
  useEffect(() => {
    if (state?.ok && !handled.current) {
      handled.current = true;
      onClose();
    }
  }, [state, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onPhoto(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Choose an image file.");
    setUploading(true);
    try {
      const blob = await avatarBlob(file);
      const path = `${creatorId}/avatars/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("page-covers").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      setPhoto(supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-dark/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="testimonial-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-canvas shadow-float sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 id="testimonial-title" className="text-[20px] font-semibold">{editing ? "Edit testimonial" : "Testimonials"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-[22px] hover:bg-surface-strong">×</button>
        </div>
        <form action={action} className="space-y-5 px-6 py-5">
          <input type="hidden" name="id" value={editing?.id ?? ""} />
          <input type="hidden" name="page_id" value={pageId} />
          <input type="hidden" name="avatar_url" value={photo} />
          <input type="hidden" name="avatar_face" value={face} />
          <input type="hidden" name="rating" value={rating} />

          <div className="space-y-2">
            <span className="block text-[14px] font-semibold">Photo</span>
            <div className="flex flex-wrap items-center gap-4">
              <FaceAvatar url={photo || null} face={face} size={88} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading" : "Change"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setPhoto(""); setFace(randomFace(face)); }}>
                  {photo ? "Use a face" : "Random face"}
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onPhoto(f);
                }}
              />
            </div>
            {uploadError && <p className="text-[13px] text-down">{uploadError}</p>}
          </div>

          <Field label="Name *">
            <input name="name" defaultValue={editing?.name ?? ""} required maxLength={80} placeholder="Enter name" className={inputClass} />
          </Field>

          <label className="block space-y-1.5">
            <span className="block text-[14px] font-semibold">Comment *</span>
            <div className="relative">
              <textarea
                name="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                required
                rows={4}
                placeholder="Enter comment"
                className={cx(textareaClass, "pb-7")}
              />
              <span className={cx("num pointer-events-none absolute bottom-3 right-4 text-[12px]", comment.length >= MAX_COMMENT ? "text-down" : "text-muted")}>
                {comment.length}/{MAX_COMMENT}
              </span>
            </div>
          </label>

          <div className="space-y-1.5">
            <span className="block text-[14px] font-semibold">Rating *</span>
            <StarInput value={rating} onChange={setRating} />
          </div>

          <FormMessage state={state?.ok ? null : state} />

          <div className="-mx-6 flex justify-end border-t border-hairline px-6 pt-4">
            <Button type="submit" variant="dark" loading={pending} disabled={pending || uploading || !rating} className="bg-ink px-6">
              {pending ? "Saving" : editing ? "Save testimonial" : "Add Testimonial"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TestimonialsPanel({ pageId, creatorId, items }: { pageId: string; creatorId: string; items: Testimonial[] }) {
  const [modal, setModal] = useState<{ editing: Testimonial | null } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl border border-hairline">
          {items.map((t, i) => (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3">
              <FaceAvatar url={t.avatar_url} face={t.avatar_face} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold">{t.name}</span>
                  <Stars rating={t.rating} size={14} />
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-body">{t.comment}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[13px]">
                <button type="button" disabled={pending || i === 0} onClick={() => start(() => moveTestimonial(t.id, pageId, "up"))} aria-label="Move up" className="rounded-lg px-1.5 py-1 hover:bg-surface-strong disabled:opacity-30">↑</button>
                <button type="button" disabled={pending || i === items.length - 1} onClick={() => start(() => moveTestimonial(t.id, pageId, "down"))} aria-label="Move down" className="rounded-lg px-1.5 py-1 hover:bg-surface-strong disabled:opacity-30">↓</button>
                <button type="button" onClick={() => setModal({ editing: t })} className="link px-1.5">Edit</button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { if (confirm(`Delete ${t.name}'s testimonial?`)) start(() => deleteTestimonial(t.id, pageId)); }}
                  className="px-1.5 text-down"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length < 20 ? (
        <Button type="button" variant="secondary" onClick={() => setModal({ editing: null })}>+ Add testimonial</Button>
      ) : (
        <p className="text-[13px] text-muted">You&apos;ve reached the limit of 20 testimonials.</p>
      )}
      {modal && <TestimonialModal pageId={pageId} creatorId={creatorId} editing={modal.editing} onClose={() => setModal(null)} />}
    </div>
  );
}
