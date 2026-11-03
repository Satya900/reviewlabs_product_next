import { requirePlan } from "@/lib/auth";
import { PageTitle, Panel } from "@/components/ui";
import { BankAccountSettings, ProfileForm } from "./forms";

export default async function SettingsPage() {
  const profile = await requirePlan();

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
      </div>
    </>
  );
}
