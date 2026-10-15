import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatPaise } from "@/lib/money";
import type { LeadFile, LeadMagnet, LeadQuestion } from "@/lib/lead-magnets";
import { LeadMagnetBuilder } from "./builder";

export const metadata = { title: "Edit lead magnet" };

export default async function EditLeadMagnet({ params }: PageProps<"/dashboard/lead-magnets/[id]">) {
  const { id } = await params;
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data: magnet } = await supabase.from("lead_magnets").select("*").eq("id", id).maybeSingle<LeadMagnet>();
  if (!magnet || magnet.status === "archived") notFound();
  const [{ data: questions }, { data: files }, { data: pages }] = await Promise.all([
    supabase.from("lead_magnet_questions").select("*").eq("magnet_id", id).order("position"),
    supabase.from("lead_magnet_files").select("id, file_name, size_bytes").eq("magnet_id", id).order("created_at"),
    supabase.from("payment_pages").select("id, slug, title, amount_paise, cover_image_url").eq("creator_id", profile.id).eq("status", "live").order("created_at", { ascending: false }),
  ]);
  return (
    <LeadMagnetBuilder
      appUrl={env.appUrl()}
      creatorId={profile.id}
      creatorName={profile.name ?? ""}
      magnet={magnet}
      questions={(questions ?? []) as LeadQuestion[]}
      files={(files ?? []) as LeadFile[]}
      products={(pages ?? []).map((p) => ({ id: p.id, slug: p.slug, title: p.title, price: formatPaise(p.amount_paise).replace(/\.00$/, ""), cover: p.cover_image_url }))}
    />
  );
}
