import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePixelRow } from "@/lib/meta";
import type { Faq, Offer, PageField, PaymentPage, Testimonial } from "@/lib/types";
import { creatorHasPlan } from "@/lib/plans-server";

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

  const [{ data: fields }, { data: files }, { data: links }, pixel, { data: testimonials }, { data: faqs }, { data: offer }, hasPlan] = await Promise.all([
    admin.from("page_fields").select("*").eq("page_id", page.id).order("position"),
    admin.from("page_files").select("id, file_name, size_bytes").eq("page_id", page.id).order("created_at"),
    // Names only: the URLs are what buyers pay for.
    admin.from("page_links").select("label").eq("page_id", page.id).order("position").order("created_at"),
    resolvePixelRow({ creatorId: page.creator_id, pageId: page.id }),
    admin.from("page_testimonials").select("*").eq("page_id", page.id).order("position").order("created_at"),
    admin.from("page_faqs").select("*").eq("page_id", page.id).order("position").order("created_at"),
    admin.from("page_offers").select("id, page_id, headline, title, description, image_url, price_paise, compare_at_paise, active").eq("page_id", page.id).eq("active", true).maybeSingle<Offer>(),
    creatorHasPlan(page.creator_id),
  ]);
  const { data: seller } = await admin.from("profiles").select("name").eq("id", page.creator_id).maybeSingle();

  return {
    page,
    fields: (fields ?? []) as PageField[],
    files: (files ?? []) as { id: string; file_name: string; size_bytes: number }[],
    linkLabels: (links ?? []).map((l) => l.label as string),
    testimonials: (testimonials ?? []) as Testimonial[],
    faqs: (faqs ?? []) as Faq[],
    // Additional offers are a Creator plan feature.
    offer: hasPlan ? offer ?? null : null,
    sellerName: (seller?.name as string | null) || "the seller",
    // The page's own pixel if set, else the account pixel; null when neither is fully connected.
    pixelId: pixel?.pixel_id ?? null,
  };
});
