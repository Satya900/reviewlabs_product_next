import { createClient } from "@/lib/supabase/server";
import { loadLeadResponses } from "@/lib/lead-responses";
import { csvResponse, rowsToCsv } from "@/lib/csv";

// CSV of all responses for one lead magnet. Available on every plan.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const data = await loadLeadResponses(id, undefined, 50000);
  if (!data) return new Response("Not found", { status: 404 });
  const { magnet, rows, labels } = data;
  const header = ["Name", "Email", "Email verified", ...(magnet.collect_phone ? ["Phone"] : []), ...labels, "Submitted at"];
  const body = rows.map((r) => [r.name, r.email, r.email_verified ? "yes" : "no", ...(magnet.collect_phone ? [r.phone] : []), ...labels.map((l) => r.answers?.[l] ?? ""), r.created_at]);
  return csvResponse(rowsToCsv(header, body), `leads-${magnet.slug}.csv`);
}
