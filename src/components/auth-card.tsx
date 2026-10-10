import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo-mark";

export function AuthCard({ title, sub, children, footer }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-surface-soft px-5 py-16 sm:px-8 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative mx-auto max-w-md">
        <div className="rounded-3xl border border-hairline bg-canvas p-8 shadow-soft sm:p-10">
          <LogoMark className="size-10" />
          <h1 className="display mt-6 text-[34px]">{title}</h1>
          {sub && <p className="mt-2 text-[16px] text-body">{sub}</p>}
          <div className="mt-8">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-[14px] text-body">{footer}</div>}
      </div>
    </section>
  );
}
