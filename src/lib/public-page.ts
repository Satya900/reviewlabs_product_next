import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Faq, Offer, PageField, PaymentPage, Testimonial } from "@/lib/types";
import { creatorTier } from "@/lib/plans-server";

// Everything the public page needs, without exposing storage paths or secrets.
export const getPublicPage = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("payment_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle<PaymentPage>();
  if (!page) return null;

  const [{ data: fields }, { data: files }, { data: links }, { data: testimonials }, { data: faqs }, { data: offer }, tier] = await Promise.all([
    admin.from("page_fields").select("*").eq("page_id", page.id).order("position"),
    admin.from("page_files").select("id, file_name, size_bytes").eq("page_id", page.id).order("created_at"),
    // Names only: the URLs are what buyers pay for.
    admin.from("page_links").select("label").eq("page_id", page.id).order("position").order("created_at"),
    admin.from("page_testimonials").select("*").eq("page_id", page.id).order("position").order("created_at"),
    admin.from("page_faqs").select("*").eq("page_id", page.id).order("position").order("created_at"),
    admin.from("page_offers").select("id, page_id, headline, title, description, image_url, price_paise, compare_at_paise, active").eq("page_id", page.id).eq("active", true).maybeSingle<Offer>(),
    creatorTier(page.creator_id),
  ]);
  const hasPlan = tier !== "none";
  // Pro features: add-on offer, coupons, no "Made with Reviewlabs" badge.
  const pro = tier === "pro" || tier === "trial";
  const { data: seller } = await admin.from("profiles").select("name").eq("id", page.creator_id).maybeSingle();

  return {
    page,
    fields: (fields ?? []) as PageField[],
    files: (files ?? []) as { id: string; file_name: string; size_bytes: number }[],
    linkLabels: (links ?? []).map((l) => l.label as string),
    testimonials: (testimonials ?? []) as Testimonial[],
    faqs: (faqs ?? []) as Faq[],
    offer: pro ? offer ?? null : null,
    couponsEnabled: pro,
    showBranding: !pro,
    sellerName: (seller?.name as string | null) || "the seller",
    // Without a plan or trial the store is offline: the page shows but takes no
    // orders. (Paid buyers' thank-you and download pages keep working.)
    storeLive: hasPlan,
  };
});
