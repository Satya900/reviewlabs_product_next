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
  const free = order.amount_paise === 0;
  const { data: morePages } = free
    ? await createAdminClient()
        .from("payment_pages")
        .select("slug, title, amount_paise, cover_image_url")
        .eq("creator_id", data.page.creator_id)
        .eq("status", "live")
        .eq("is_free", false)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] };

  return (
    <div className="mx-auto w-full max-w-lg py-4">
      <MetaPixel pixelId={data.pixelId} pageId={data.page.id} trackPageEvents={false} />
      <OrderStatusView
        orderId={order.id}
        initialStatus={order.status}
        title={order.offer_title ? `${order.page_title} + ${order.offer_title}` : order.page_title}
        amountLabel={formatPaise(order.amount_paise)}
        thankYouMessage={free && data.page.thank_you_message === "Thank you for your purchase!" ? "Enjoy your free download!" : data.page.thank_you_message}
        files={(await orderFiles({ page_id: order.page_id, offer_id: order.offer_id })).map(({ id, file_name, size_bytes }) => ({ id, file_name, size_bytes }))}
        pixel={{
          pixelId: data.pixelId,
          eventId: free ? eventIds.lead(order.id) : eventIds.purchase(order.id),
          event: free ? "Lead" : "Purchase",
          data: { content_ids: [data.page.id], content_name: order.page_title, content_type: "product", value: order.amount_paise / 100, currency: order.currency },
        }}
        retryHref={`/p/${slug}`}
        free={free}
        more={(morePages ?? []).map((m) => ({ slug: m.slug, title: m.title, price: formatPaise(m.amount_paise).replace(/\.00$/, ""), cover: m.cover_image_url }))}
      />
    </div>
  );
}
