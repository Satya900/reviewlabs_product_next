import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui";
import { PaymentsBrowser } from "@/components/payments-browser";
import { browserParams } from "@/lib/follow-up";
import { loadPayments } from "@/lib/payments-list";
import { hasCreatorPlan } from "@/lib/plans";
import { PageTabs } from "../page-tabs";

export const metadata = { title: "Payments" };

// One product's checkouts: who paid, who left, who failed, with follow-ups.
export default async function PagePayments({ params: routeParams, searchParams }: PageProps<"/dashboard/pages/[id]/payments">) {
  const { id } = await routeParams;
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data: page } = await supabase.from("payment_pages").select("id, title, status").eq("id", id).eq("creator_id", profile.id).maybeSingle();
  if (!page) notFound();
  const params = browserParams(await searchParams);
  const data = await loadPayments(supabase, { creatorId: profile.id, pageId: page.id, ...params });
  const exportQs = new URLSearchParams({ filter: params.filter, q: params.q, from: params.from, to: params.to, product: page.id });

  return (
    <>
      <div className="min-w-0 space-y-1">
        <Link href="/dashboard/pages" className="link text-[14px]">← Back to pages</Link>
        <h1 className="display flex flex-wrap items-center gap-3 text-[32px]">{page.title} <Badge status={page.status} /></h1>
      </div>
      <PageTabs pageId={page.id} active="payments" />
      <PaymentsBrowser
        basePath={`/dashboard/pages/${page.id}/payments`}
        params={{ ...params, product: undefined, filter: data.filter, page: data.page }}
        rows={data.rows}
        total={data.total}
        counts={data.counts}
        appUrl={env.appUrl()}
        csv={{ allowed: hasCreatorPlan(profile), href: `/dashboard/orders/export?${exportQs}` }}
      />
    </>
  );
}
