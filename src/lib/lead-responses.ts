import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LeadResponseRow = { id: string; name: string; email: string; phone: string; answers: Record<string, string>; email_verified: boolean; created_at: string };

// A creator's responses for one lead magnet (RLS limits it to their own).
export async function loadLeadResponses(magnetId: string, search?: string, limit = 500) {
  const supabase = await createClient();
  const { data: magnet } = await supabase.from("lead_magnets").select("id, title, slug, collect_phone").eq("id", magnetId).maybeSingle();
  if (!magnet) return null;
  let query = supabase
    .from("lead_responses")
    .select("id, name, email, phone, answers, email_verified, created_at", { count: "exact" })
    .eq("magnet_id", magnetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const q = search?.trim().replace(/[%_,()]/g, "");
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as LeadResponseRow[];
  // Question labels in first-seen order, so old answers still show after edits.
  const labels = [...new Set(rows.flatMap((r) => Object.keys(r.answers ?? {})))];
  return { magnet, rows, count: count ?? rows.length, labels };
}
