import type { ReactNode } from "react";
import { PageHero, Section } from "@/components/marketing";
import { site } from "@/lib/site";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHero kicker={`Last updated ${site.policiesUpdated}`} title={title} sub={intro} />
      <Section className="pt-2 md:pt-4">
        <div className="max-w-3xl divide-y divide-hairline border-t border-hairline">{children}</div>
      </Section>
    </>
  );
}

export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 py-8 sm:grid-cols-[48px_1fr]">
      <span className="num text-[14px] text-primary">{String(n).padStart(2, "0")}</span>
      <div>
        <h2 className="text-[20px] font-semibold">{title}</h2>
        <div className="mt-3 space-y-3 text-[16px] text-body [&_a]:font-semibold [&_a]:text-primary [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
      </div>
    </section>
  );
}
