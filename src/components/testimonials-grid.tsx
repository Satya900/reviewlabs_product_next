"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { FaceAvatar } from "@/components/face-avatar";
import { cx } from "@/components/ui";

export type TestimonialCard = { id: string; name: string; comment: string; rating: number; avatar_url: string | null; avatar_face: string };

export function Stars({ rating, size = 20 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <path
            d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
            fill={i <= rating ? "#f5c542" : "#e5e7eb"}
            stroke={i <= rating ? "#f5c542" : "#e5e7eb"}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function Card({ t }: { t: TestimonialCard }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const textRef = useRef<HTMLQuoteElement>(null);

  // Offer "Read more" only when the 4-line cut actually hides text.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || open) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, t.comment]);
  return (
    <figure
      className={cx("relative flex flex-col rounded-3xl border border-hairline bg-canvas p-6", (long || open) && "cursor-pointer")}
      onClick={() => (long || open) && setOpen(!open)}
    >
      <svg viewBox="0 0 48 40" className="absolute right-6 top-6 h-8 w-9 text-[#fdecef]" aria-hidden>
        <path d="M0 22C0 10 7 2 18 0l2 5c-6 2-9 6-9 11h8v18H0zM28 22C28 10 35 2 46 0l2 5c-6 2-9 6-9 11h8v18H28z" fill="currentColor" />
      </svg>
      <Stars rating={t.rating} />
      <blockquote ref={textRef} className={cx("mt-4 whitespace-pre-line text-[16px] leading-relaxed text-ink", !open && "line-clamp-4")}>{t.comment}</blockquote>
      {(long || open) && <span className="mt-1 text-[13px] font-semibold text-primary">{open ? "Show less" : "Read more"}</span>}
      {/* Spacer keeps names aligned at the bottom without stretching the text box. */}
      <span className="flex-1" />
      <figcaption className="mt-5 flex items-center gap-3">
        <FaceAvatar url={t.avatar_url} face={t.avatar_face} size={40} />
        <span className="text-[16px] font-semibold">{t.name}</span>
      </figcaption>
    </figure>
  );
}

export function TestimonialsGrid({ items }: { items: TestimonialCard[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-3xl bg-canvas p-6 @lg:p-8">
      <h2 className="text-[20px] font-semibold">Testimonials</h2>
      <div className="mt-5 grid gap-4 @xl:grid-cols-2">
        {items.map((t) => <Card key={t.id} t={t} />)}
      </div>
    </section>
  );
}
