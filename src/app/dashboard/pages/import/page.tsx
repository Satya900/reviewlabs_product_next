import Link from "next/link";
import { requirePlan } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { hasCreatorPlan } from "@/lib/plans";
import { Importer } from "./importer";

export const metadata = { title: "Import from Superprofile" };

export default async function ImportPage() {
  const profile = await requirePlan();
  const creator = hasCreatorPlan(profile);

  return (
    <>
      <div className="space-y-1">
        <Link href="/dashboard/pages" className="link text-[14px]">← Payment pages</Link>
        <PageTitle sub="Bring a product page over from Superprofile in about a minute. You'll get a draft to check before anything goes live.">
          Import from Superprofile
        </PageTitle>
      </div>
      <Importer creatorPlan={creator} />
    </>
  );
}
