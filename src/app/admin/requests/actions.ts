"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setRequestStatus(id: string, status: "new" | "contacted" | "closed") {
  await requireAdmin();
  if (!["new", "contacted", "closed"].includes(status)) return;
  await createAdminClient().from("custom_requests").update({ status }).eq("id", id);
  revalidatePath("/admin/requests");
}
