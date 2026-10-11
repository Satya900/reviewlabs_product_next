"use client";

import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

export type FaqItem = { id: string; question: string; answer: string };

// Turns plain-text answers into text plus safe http(s) links. No HTML is ever rendered.
function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s<>"')]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2">
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

function Item({ faq, defaultOpen }: { faq: FaqItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-b border-hairline last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-[16px] font-semibold"
        >
          <span>{faq.question}</span>
          <span
            aria-hidden
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[18px] leading-none transition-transform duration-200",
              open && "rotate-45",
            )}
          >
            +
          </span>
        </button>
      </h3>
      <div
        id={`${id}-answer`}
        role="region"
        className={cx("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <p className="whitespace-pre-line pb-4 pr-10 text-[15px] leading-relaxed text-body">{linkify(faq.answer)}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-3xl bg-canvas p-6 @lg:p-8">
      <h2 className="text-[20px] font-semibold">Frequently asked questions</h2>
      <div className="mt-2">
        {items.map((f, i) => <Item key={f.id} faq={f} defaultOpen={i === 0} />)}
      </div>
    </section>
  );
}
