import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentTier } from "@/lib/plans";

// Entitlement checks by creator id, using the same SQL rules the database enforces.

export async function creatorTier(creatorId: string): Promise<CurrentTier> {
  const { data, error } = await createAdminClient().rpc("creator_plan_tier", { p_creator_id: creatorId });
  if (error) {
    console.error("[plans] creator_plan_tier:", error.message);
    return "none";
  }
  return (data as CurrentTier) ?? "none";
}

// A paid plan or the trial: the store is live and selling features work.
export async function creatorHasPlan(creatorId: string): Promise<boolean> {
  return (await creatorTier(creatorId)) !== "none";
}

// Pro or the trial: AutoDM.
export async function creatorHasPro(creatorId: string): Promise<boolean> {
  const tier = await creatorTier(creatorId);
  return tier === "pro" || tier === "trial";
}
