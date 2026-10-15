"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteFaq, moveFaq, saveFaq } from "./faq-actions";
import { Button, FormMessage, inputClass, textareaClass, cx } from "@/components/ui";
import type { Faq } from "@/lib/types";

const MAX_Q = 150;
const MAX_A = 1000;

// Common questions for digital products; answers are editable before saving.
const SUGGESTIONS = [
  {
    question: "How will I receive the file?",
    answer: "Right after payment you'll see a download button on the thank-you page, and we email the same download link to the address you enter at checkout.",
  },
  {
    question: "Can I download it again later?",
    answer: "Yes. Your access never expires. Keep the email, or enter your email on the download page to get your link again.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "UPI, debit and credit cards, and netbanking, processed securely by Razorpay.",
  },
  {
    question: "Can I get a refund?",
    answer: "Since this is a digital product delivered instantly, refunds are only given if the file doesn't work or you were charged twice. Write to us within 7 days with your order ID.",
  },
];

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cx("num pointer-events-none absolute bottom-3 right-4 text-[12px]", value >= max ? "text-down" : "text-muted")}>{value}/{max}</span>;
}

function FaqModal({ pageId, editing, onClose }: { pageId: string; editing: Pick<Faq, "question" | "answer"> & { id?: string }; onClose: () => void }) {
  const [state, action, pending] = useActionState(saveFaq, null);
  const [question, setQuestion] = useState(editing.question);
  const [answer, setAnswer] = useState(editing.answer);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-dark/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-canvas shadow-float sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 id="faq-title" className="text-[20px] font-semibold">{editing.id ? "Edit question" : "Add a question"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-[22px] hover:bg-surface-strong">×</button>
        </div>
        <form action={action} className="space-y-5 px-6 py-5">
          <input type="hidden" name="id" value={editing.id ?? ""} />
          <input type="hidden" name="page_id" value={pageId} />
          <label className="block space-y-1.5">
            <span className="block text-[14px] font-semibold">Question *</span>
            <div className="relative">
              <input
                name="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_Q))}
                required
                autoFocus
                placeholder="For example: Is this suitable for beginners?"
                className={cx(inputClass, "pr-20")}
              />
              <span className={cx("num pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px]", question.length >= MAX_Q ? "text-down" : "text-muted")}>
                {question.length}/{MAX_Q}
              </span>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="block text-[14px] font-semibold">Answer *</span>
            <div className="relative">
              <textarea
                name="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.slice(0, MAX_A))}
                required
                rows={6}
                placeholder="Write a clear, short answer. Links starting with https:// become clickable."
                className={cx(textareaClass, "pb-7")}
              />
              <Counter value={answer.length} max={MAX_A} />
            </div>
          </label>
          <FormMessage state={state?.ok ? null : state} />
          <div className="-mx-6 flex justify-end border-t border-hairline px-6 pt-4">
            <Button type="submit" variant="dark" loading={pending} disabled={pending || !question.trim() || !answer.trim()} className="bg-ink px-6">
              {pending ? "Saving" : editing.id ? "Save question" : "Add question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FaqsPanel({ pageId, items }: { pageId: string; items: Faq[] }) {
  const [modal, setModal] = useState<(Pick<Faq, "question" | "answer"> & { id?: string }) | null>(null);
  const [pending, start] = useTransition();
  const existing = new Set(items.map((f) => f.question.trim().toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !existing.has(s.question.toLowerCase()));

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl border border-hairline">
          {items.map((f, i) => (
            <li key={f.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{f.question}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-body">{f.answer}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[13px]">
                <button type="button" disabled={pending || i === 0} onClick={() => start(() => moveFaq(f.id, pageId, "up"))} aria-label="Move up" className="rounded-lg px-1.5 py-1 hover:bg-surface-strong disabled:opacity-30">↑</button>
                <button type="button" disabled={pending || i === items.length - 1} onClick={() => start(() => moveFaq(f.id, pageId, "down"))} aria-label="Move down" className="rounded-lg px-1.5 py-1 hover:bg-surface-strong disabled:opacity-30">↓</button>
                <button type="button" onClick={() => setModal(f)} className="link px-1.5">Edit</button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { if (confirm("Delete this question?")) start(() => deleteFaq(f.id, pageId)); }}
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
        <div className="space-y-3">
          <Button type="button" variant="secondary" onClick={() => setModal({ question: "", answer: "" })}>+ Add question</Button>
          {suggestions.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-muted">Quick start</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.question}
                    type="button"
                    onClick={() => setModal({ question: s.question, answer: s.answer })}
                    className="rounded-full border border-hairline px-3 py-1.5 text-[13px] text-ink hover:border-primary hover:text-primary"
                  >
                    + {s.question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-muted">You&apos;ve reached the limit of 20 questions.</p>
      )}

      {modal && <FaqModal pageId={pageId} editing={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
