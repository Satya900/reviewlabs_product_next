import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/ui";
import { BankAccountSettings, ProfileForm, PixelForm } from "./forms";
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
        <Panel title="Profile">
          <ProfileForm profile={profile} />
        </Panel>
        <Panel title="Bank account for payouts">
          <p className="mb-5 text-[14px] text-body">
            When you request a payout from Earnings, we send it to this account. You need to add it, with a cancelled cheque, before you can request a payout.
          </p>
          <BankAccountSettings profile={profile} />
        </Panel>
        <Panel title="Meta Pixel and Conversions API">
          <p className="mb-5 text-[14px] text-body">
            Track PageView, ViewContent, InitiateCheckout and Purchase in Meta. A Pixel ID is all you need to start.
            Add a Conversions API token as well and each event is also sent from our server with the same event ID, so
            Meta counts it once and still sees sales that ad blockers or closed tabs would hide.
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
