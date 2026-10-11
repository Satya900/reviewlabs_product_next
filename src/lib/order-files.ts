import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeliverableFile = { id: string; file_name: string; size_bytes: number; storage_path: string };

// Everything an order delivers: the product's files, then the add-on's files if it was bought.
export async function orderFiles(order: { page_id: string; offer_id: string | null }): Promise<DeliverableFile[]> {
  const admin = createAdminClient();
  const [{ data: main }, { data: extra }] = await Promise.all([
    admin.from("page_files").select("id, file_name, size_bytes, storage_path").eq("page_id", order.page_id).order("created_at"),
    order.offer_id
      ? admin.from("offer_files").select("id, file_name, size_bytes, storage_path").eq("offer_id", order.offer_id).order("created_at")
      : Promise.resolve({ data: [] as DeliverableFile[] }),
  ]);
  return [...((main ?? []) as DeliverableFile[]), ...((extra ?? []) as DeliverableFile[])];
}
