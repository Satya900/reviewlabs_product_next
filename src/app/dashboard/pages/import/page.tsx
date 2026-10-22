import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { UpgradeCard } from "@/components/upgrade-card";
import { FREE_PAGE_LIMIT, hasCreatorPlan } from "@/lib/plans";
import { Importer } from "./importer";

export const metadata = { title: "Import from Superprofile" };

export default async function ImportPage() {
  const profile = await requireCreator();
  const creator = hasCreatorPlan(profile);
  const { count } = await (await createClient())
    .from("payment_pages")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", profile.id)
    .neq("status", "archived");
  const atLimit = !creator && (count ?? 0) >= FREE_PAGE_LIMIT;

  return (
    <>
      <div className="space-y-1">
        <Link href="/dashboard/pages" className="link text-[14px]">← Payment pages</Link>
        <PageTitle sub="Bring a product page over from Superprofile in about a minute. You'll get a draft to check before anything goes live.">
          Import from Superprofile
        </PageTitle>
      </div>
      {atLimit ? <UpgradeCard feature="pages" compact /> : <Importer creatorPlan={creator} />}
    </>
  );
}
