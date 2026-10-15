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
  const { data: pages } = await supabase
    .from("payment_pages")
    .select("id, slug, title, amount_paise, is_free, cover_image_url, status, storefront_visible")
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
        pages={(pages ?? []).map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          amountPaise: p.amount_paise,
          isFree: p.is_free,
          cover: p.cover_image_url,
          live: p.status === "live",
          visible: p.storefront_visible,
        }))}
      />
    </>
  );
}
