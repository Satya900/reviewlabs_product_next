// Seller's own contact and policies, shown at the bottom of a product page.
export function PagePolicies({ sellerName, supportEmail, refundPolicy, terms }: { sellerName: string; supportEmail: string | null; refundPolicy: string; terms: string }) {
  if (!supportEmail && !refundPolicy && !terms) return null;
  return (
    <section className="rounded-3xl bg-canvas p-6 @lg:p-8">
      {supportEmail && (
        <div>
          <h2 className="text-[18px] font-semibold">Contact {sellerName}</h2>
          <a href={`mailto:${supportEmail}`} className="mt-2 inline-flex items-center gap-2 text-[15px] text-ink">
            <svg viewBox="0 0 24 24" className="size-5 text-body" aria-hidden><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            {supportEmail}
          </a>
        </div>
      )}
      {[
        { title: "Refund policy", body: refundPolicy },
        { title: "Terms and conditions", body: terms },
      ]
        .filter((p) => p.body)
        .map((p) => (
          <details key={p.title} className="group mt-5 border-t border-hairline pt-5 first:mt-0 first:border-t-0 first:pt-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
              {p.title}
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[18px] leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-body">{p.body}</p>
          </details>
        ))}
    </section>
  );
}
