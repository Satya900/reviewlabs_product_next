import Link from "next/link";
import { MarketingShell } from "@/components/site-shell";
import { PageHero } from "@/components/marketing";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <MarketingShell>
      <PageHero kicker="404" title="This page isn't here." sub="The link may be wrong, or the creator has taken this product down.">
        <Link href="/" className={buttonClass.primary}>Go to the home page</Link>
      </PageHero>
    </MarketingShell>
  );
}
