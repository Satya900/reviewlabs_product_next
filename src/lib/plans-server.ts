import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Entitlement check by creator id, using the same SQL rule the database enforces.
export async function creatorHasPlan(creatorId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("creator_has_plan", { p_creator_id: creatorId });
  if (error) {
    console.error("[plans] creator_has_plan:", error.message);
    return false;
  }
  return data === true;
}
