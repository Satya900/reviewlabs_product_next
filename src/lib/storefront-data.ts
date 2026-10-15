import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { creatorHasPlan } from "@/lib/plans-server";
import { resolvePixelRow } from "@/lib/meta";
import type { StorefrontData } from "@/components/storefront-view";

// Public storefront data. Only safe profile fields and live, visible pages.
export const getStorefront = cache(async (handle: string): Promise<(StorefrontData & { creatorId: string; pixelId: string | null }) | null> => {
  const clean = handle.toLowerCase();
  if (!/^[a-z0-9_.]{3,30}$/.test(clean)) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, handle, bio, avatar_url, social_links, featured_page_id")
    .eq("handle", clean)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: pages }, hasPlan, pixel] = await Promise.all([
    admin
      .from("payment_pages")
      .select("id, slug, title, amount_paise, is_free, cover_image_url")
      .eq("creator_id", profile.id)
      .eq("status", "live")
      .eq("storefront_visible", true)
      .order("storefront_position")
      .order("created_at", { ascending: false }),
    creatorHasPlan(profile.id),
    resolvePixelRow({ creatorId: profile.id }),
  ]);

  return {
    creatorId: profile.id,
    name: profile.name ?? "",
    handle: profile.handle,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatar_url,
    socials: (profile.social_links ?? {}) as Record<string, string>,
    featuredId: profile.featured_page_id,
    showBranding: !hasPlan,
    pixelId: pixel?.pixel_id ?? null,
    products: (pages ?? []).map((p) => ({ id: p.id, slug: p.slug, title: p.title, amountPaise: p.amount_paise, isFree: p.is_free, cover: p.cover_image_url })),
  };
});
