import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { Badge, EmptyState, PageTitle, Panel, tableClass } from "@/components/ui";
import type { Coupon } from "@/lib/coupons";
import { CouponActions, CouponForm } from "./coupon-forms";
import { hasCreatorPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function isExpired(c: Coupon, now: number) {
  return c.expires_at !== null && new Date(c.expires_at).getTime() <= now;
}

function currentTime() {
  return Date.now();
}

export default async function CouponsPage() {
  const profile = await requireCreator();
  if (!hasCreatorPlan(profile)) {
    return (
      <>
        <PageTitle>Coupons</PageTitle>
        <UpgradeCard feature="coupons" />
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: coupons }, { data: pages }] = await Promise.all([
    supabase.from("coupons").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("payment_pages").select("id, title").eq("creator_id", profile.id).neq("status", "archived").order("created_at"),
  ]);
  const pageTitle = new Map((pages ?? []).map((p) => [p.id, p.title]));
  const now = currentTime();

  return (
    <>
      <PageTitle sub="Buyers enter the code at checkout. Discounts come off the price before Razorpay charges them.">Coupons</PageTitle>
      <Panel title="New coupon">
        <CouponForm pages={pages ?? []} />
      </Panel>
      {!coupons?.length ? (
        <EmptyState>No coupons yet. Create one above for your next launch.</EmptyState>
      ) : (
        <div className={tableClass.wrap}>
          <table className={`${tableClass.table} min-w-[720px]`}>
            <thead>
              <tr>
                <th className={tableClass.th}>Code</th>
                <th className={tableClass.th}>Discount</th>
                <th className={tableClass.th}>Applies to</th>
                <th className={tableClass.th}>Used</th>
                <th className={tableClass.th}>Expires</th>
                <th className={tableClass.th}>Status</th>
                <th className={tableClass.th} />
              </tr>
            </thead>
            <tbody>
              {(coupons as Coupon[]).map((c) => {
                const status = !c.active ? "archived" : isExpired(c, now) || (c.max_uses !== null && c.used_count >= c.max_uses) ? "failed" : "live";
                return (
                  <tr key={c.id}>
                    <td className={`${tableClass.td} num`}>{c.code}</td>
                    <td className={tableClass.td}>{c.discount_type === "percent" ? `${c.value}% off` : `${formatPaise(c.value)} off`}</td>
                    <td className={tableClass.td}>{c.page_id ? pageTitle.get(c.page_id) ?? "Archived page" : "All your pages"}</td>
                    <td className={tableClass.td}>{c.used_count}{c.max_uses !== null ? ` of ${c.max_uses}` : ""}</td>
                    <td className={`${tableClass.td} whitespace-nowrap`}>{c.expires_at ? dateFmt.format(new Date(c.expires_at)) : "Never"}</td>
                    <td className={tableClass.td}>
                      <Badge status={status} label={status === "archived" ? "Off" : status === "failed" ? (isExpired(c, now) ? "Expired" : "Used up") : "Active"} />
                    </td>
                    <td className={tableClass.td}><CouponActions id={c.id} active={c.active} canDelete={c.used_count === 0} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
