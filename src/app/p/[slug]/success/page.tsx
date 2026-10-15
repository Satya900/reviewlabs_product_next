import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicPage } from "@/lib/public-page";
import { eventIds } from "@/lib/meta";
import { formatPaise } from "@/lib/money";
import { MetaPixel } from "@/components/meta-pixel";
import { OrderStatusView } from "./order-status";
import { orderFiles } from "@/lib/order-files";

export const metadata = { title: "Payment status", robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: PageProps<"/p/[slug]/success">) {
  const { slug } = await params;
  const { order: orderId } = await searchParams;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) notFound();

  const data = await getPublicPage(slug);
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id, page_id, status, amount_paise, currency, page_title, offer_id, offer_title")
    .eq("id", orderId)
    .maybeSingle();
  if (!data || !order || order.page_id !== data.page.id) notFound();

  return (
    <div className="mx-auto w-full max-w-lg py-4">
      <MetaPixel pixelId={data.pixelId} pageId={data.page.id} trackPageEvents={false} />
      <OrderStatusView
        orderId={order.id}
        initialStatus={order.status}
        title={order.offer_title ? `${order.page_title} + ${order.offer_title}` : order.page_title}
        amountLabel={formatPaise(order.amount_paise)}
        thankYouMessage={data.page.thank_you_message}
        files={(await orderFiles({ page_id: order.page_id, offer_id: order.offer_id })).map(({ id, file_name, size_bytes }) => ({ id, file_name, size_bytes }))}
        pixel={{
          pixelId: data.pixelId,
          eventId: eventIds.purchase(order.id),
          data: { content_ids: [data.page.id], content_name: order.page_title, content_type: "product", value: order.amount_paise / 100, currency: order.currency },
        }}
        retryHref={`/p/${slug}`}
      />
    </div>
  );
}
