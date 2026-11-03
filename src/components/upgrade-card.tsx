import Link from "next/link";
import { buttonClass, cx } from "@/components/ui";
import { planName, premiumCopy, priceLabel, type PremiumFeature } from "@/lib/plans";

// Shown in place of a feature the creator's plan doesn't include.
export function UpgradeCard({ feature, compact }: { feature: PremiumFeature; compact?: boolean }) {
  const copy = premiumCopy[feature];
  return (
    <div className={cx("relative overflow-hidden rounded-3xl bg-dark text-white", compact ? "p-6" : "p-8")}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/40 blur-[90px]" />
      <div className="relative space-y-3">
        <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">{planName(copy.tier)} plan</span>
        <p className={cx("font-semibold", compact ? "text-[17px]" : "text-[22px]")}>{copy.title}</p>
        <p className="max-w-lg text-[15px] text-on-dark-soft">{copy.body}</p>
        <Link href="/dashboard/billing" className={cx(buttonClass.primary, "mt-2")}>
          Get {planName(copy.tier)} for {priceLabel(copy.tier, "month")}/month
        </Link>
      </div>
    </div>
  );
}
