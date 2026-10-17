import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/ui";
import { ProfileForm, PixelForm } from "./forms";
import { hasCreatorPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";

export default async function SettingsPage() {
  const profile = await requireCreator();
  const { data: pixel } = await createAdminClient()
    .from("creator_pixel_settings")
    .select("pixel_id, test_event_code, capi_token_encrypted")
    .eq("creator_id", profile.id)
    .maybeSingle();

  return (
    <>
      <PageTitle>Settings</PageTitle>
      <div className="grid max-w-3xl gap-6">
        <Panel title="Profile and payouts">
          <p className="mb-5 text-[14px] text-body">We send your earnings every day to the UPI ID or bank account below. Sales are ready to pay 24 hours after they happen.</p>
          <ProfileForm profile={profile} />
        </Panel>
        <Panel title="Meta Pixel and Conversions API">
          <p className="mb-5 text-[14px] text-body">
            Track PageView, ViewContent, InitiateCheckout and Purchase in Meta. Each event is sent from the buyer&apos;s
            browser and from our server with the same event ID, so Meta counts it once and still sees sales that ad
            blockers or closed tabs would hide.
          </p>
          {hasCreatorPlan(profile) ? (
            <PixelForm pixelId={pixel?.pixel_id ?? ""} testEventCode={pixel?.test_event_code ?? ""} hasToken={Boolean(pixel?.capi_token_encrypted)} />
          ) : (
            <UpgradeCard feature="meta" compact />
          )}
        </Panel>
      </div>
    </>
  );
}
