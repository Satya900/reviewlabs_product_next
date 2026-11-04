import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { hasProPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";
import { PageTitle } from "@/components/ui";
import { Composer } from "./composer";

export const metadata = { title: "New email" };

export default async function NewEmail() {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) return <><PageTitle>New email</PageTitle><UpgradeCard feature="email" /></>;
  const supabase = await createClient();
  const [{ data: pages }, { data: magnets }] = await Promise.all([
    supabase.from("payment_pages").select("id, title, slug, status").eq("creator_id", profile.id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("lead_magnets").select("id, title, slug, status").eq("creator_id", profile.id).neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageTitle sub="Plain text works best. Leave a blank line between paragraphs; links become clickable.">New email</PageTitle>
      <Composer
        creatorName={profile.name?.trim() || "Your name"}
        appUrl={env.appUrl()}
        pages={(pages ?? []).map((p) => ({ id: p.id, title: p.title, slug: p.slug, live: p.status === "live" }))}
        magnets={(magnets ?? []).map((m) => ({ id: m.id, title: m.title, slug: m.slug, live: m.status === "live" }))}
      />
    </>
  );
}
