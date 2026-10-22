import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { Badge, EmptyState, PageTitle, Panel } from "@/components/ui";
import type { PaymentPage } from "@/lib/types";
import { NewPageForm } from "./new-page-form";
import { FREE_PAGE_LIMIT, hasCreatorPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";

export default async function PagesList() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("payment_pages")
    .select("*")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageTitle sub="Each page sells one product and has its own link.">Payment pages</PageTitle>
      {(() => {
        const used = (pages ?? []).filter((p) => p.status !== "archived").length;
        const atLimit = !hasCreatorPlan(profile) && used >= FREE_PAGE_LIMIT;
        return atLimit ? (
          <UpgradeCard feature="pages" compact />
        ) : (
          <Panel title="New page" aside={!hasCreatorPlan(profile) ? <span className="text-[13px] text-muted">{used} of {FREE_PAGE_LIMIT} on Free</span> : undefined}>
            <NewPageForm />
            <p className="mt-3 text-[14px] text-body">
              Moving from Superprofile? <Link href="/dashboard/pages/import" className="link">Import a page in one click</Link>
            </p>
          </Panel>
        );
      })()}
      <div className="space-y-3">
        {(pages as PaymentPage[] | null)?.map((p) => (
          <Link key={p.id} href={`/dashboard/pages/${p.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-hairline bg-canvas p-5 transition hover:shadow-soft">
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold">{p.title}</span>
              <span className="block break-all text-[14px] text-muted">/p/{p.slug}</span>
            </span>
            <span className="flex items-center gap-4"><Badge status={p.status} /><span className="num text-[16px]">{formatPaise(p.amount_paise)}</span></span>
          </Link>
        ))}
        {!pages?.length && <EmptyState>No pages yet. Make your first one above.</EmptyState>}
      </div>
    </>
  );
}
