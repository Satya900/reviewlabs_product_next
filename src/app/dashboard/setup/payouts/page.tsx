import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { PageTitle, Panel } from "@/components/ui";
import { PayoutSetup } from "./payout-setup";

export const metadata = { title: "Add your bank account" };

// Step 2 of signup: the bank account payouts go to. Can be skipped.
export default async function PayoutSetupPage() {
  const profile = await requireCreator();
  if (profile.payout_bank_submitted_at) redirect("/dashboard?welcome=1");
  return (
    <>
      <PageTitle sub="This is where we send your earnings when you request a payout. It takes about a minute.">
        Add your bank account
      </PageTitle>
      <Panel title="Bank details" className="max-w-2xl">
        <PayoutSetup creatorId={profile.id} />
      </Panel>
    </>
  );
}
