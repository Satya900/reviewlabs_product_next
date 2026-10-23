import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { PageTitle } from "@/components/ui";
import { PaymentsBrowser } from "@/components/payments-browser";
import { browserParams } from "@/lib/follow-up";
import { loadPayments } from "@/lib/payments-list";
import { hasCreatorPlan } from "@/lib/plans";

export const metadata = { title: "Orders" };

// Every checkout across all products, with follow-up buttons.
export default async function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  const profile = await requireCreator();
  const params = browserParams(await searchParams);
  const supabase = await createClient();
  const [data, { data: products }] = await Promise.all([
    loadPayments(supabase, { creatorId: profile.id, pageId: params.product || null, ...params }),
    supabase.from("payment_pages").select("id, title").eq("creator_id", profile.id).neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  const exportQs = new URLSearchParams({ filter: params.filter, q: params.q, from: params.from, to: params.to, product: params.product });

  return (
    <>
      <PageTitle sub="Everyone who started checkout, paid or not. Filter by status to follow up with buyers who didn't finish.">Orders</PageTitle>
      <PaymentsBrowser
        basePath="/dashboard/orders"
        params={{ ...params, filter: data.filter, page: data.page }}
        rows={data.rows}
        total={data.total}
        counts={data.counts}
        appUrl={env.appUrl()}
        csv={{ allowed: hasCreatorPlan(profile), href: `/dashboard/orders/export?${exportQs}` }}
        products={products ?? []}
      />
    </>
  );
}
