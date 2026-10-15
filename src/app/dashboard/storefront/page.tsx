import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { hasCreatorPlan } from "@/lib/plans";
import { PageTitle } from "@/components/ui";
import { StorefrontEditor } from "./storefront-editor";

export const metadata = { title: "Storefront" };

export default async function StorefrontSettings() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data: magnets } = await supabase
    .from("lead_magnets")
    .select("id, slug, title, cover_image_url")
    .eq("status", "live")
    .eq("storefront_visible", true)
    .order("created_at", { ascending: false });
  const { data: pages } = await supabase
    .from("payment_pages")
    .select("id, slug, title, amount_paise, cover_image_url, status, storefront_visible")
    .eq("creator_id", profile.id)
    .neq("status", "archived")
    .order("storefront_position")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageTitle sub="One link for your Instagram bio with all your products, your photo and your socials.">Storefront</PageTitle>
      <StorefrontEditor
        appUrl={env.appUrl()}
        creatorId={profile.id}
        showBranding={!hasCreatorPlan(profile)}
        initial={{
          handle: profile.handle ?? "",
          name: profile.name ?? "",
          bio: profile.bio ?? "",
          avatarUrl: profile.avatar_url ?? "",
          socials: (profile.social_links ?? {}) as Record<string, string>,
          featuredId: profile.featured_page_id ?? "",
        }}
        magnets={(magnets ?? []).map((m) => ({ id: m.id, slug: m.slug, title: m.title, cover: m.cover_image_url }))}
        pages={(pages ?? []).map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          amountPaise: p.amount_paise,
          cover: p.cover_image_url,
          live: p.status === "live",
          visible: p.storefront_visible,
        }))}
      />
    </>
  );
}
