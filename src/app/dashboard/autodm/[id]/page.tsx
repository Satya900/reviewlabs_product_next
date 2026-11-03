import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { AutomationForm } from "../automation-form";
import type { MediaOption } from "../automation-draft";
import { DeleteAutomationButton } from "../autodm-controls";
import { loadFormData } from "../form-data";

export const metadata = { title: "Edit automation" };

export default async function EditAutomationPage({ params }: PageProps<"/dashboard/autodm/[id]">) {
  const { id } = await params;
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data: a } = await supabase.from("dm_automations").select("*").eq("id", id).eq("creator_id", profile.id).maybeSingle();
  if (!a) notFound();
  const { media, mediaError, pages } = await loadFormData(profile.id);
  return (
    <>
      <Link href="/dashboard/autodm" className="text-[14px] font-semibold text-primary">← AutoDM</Link>
      <PageTitle>{a.name}</PageTitle>
      <AutomationForm
        draft={{
          id: a.id,
          name: a.name,
          active: a.active,
          postScope: a.post_scope,
          media: (a.media_previews ?? []) as MediaOption[],
          matchMode: a.match_mode,
          keywords: (a.keywords ?? []).join(", "),
          dmMessage: a.dm_message,
          linkKind: a.link_kind,
          pageId: a.page_id ?? "",
          linkUrl: a.link_url ?? "",
          publicReplyEnabled: a.public_reply_enabled,
          publicReplies: a.public_replies ?? [],
        }}
        media={media}
        mediaError={mediaError}
        pages={pages}
      />
      <div><DeleteAutomationButton id={a.id} /></div>
    </>
  );
}
