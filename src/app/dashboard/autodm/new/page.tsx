import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { AutomationForm } from "../automation-form";
import { emptyDraft } from "../automation-draft";
import { loadFormData } from "../form-data";

export const metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  const profile = await requireCreator();
  const { media, mediaError, pages } = await loadFormData(profile.id);
  const firstLive = pages.find((p) => p.status === "live");
  return (
    <>
      <Link href="/dashboard/autodm" className="text-[14px] font-semibold text-primary">← AutoDM</Link>
      <PageTitle>New automation</PageTitle>
      <AutomationForm draft={{ ...emptyDraft, pageId: firstLive?.id ?? "", linkKind: firstLive ? "page" : "url" }} media={media} mediaError={mediaError} pages={pages} />
    </>
  );
}
