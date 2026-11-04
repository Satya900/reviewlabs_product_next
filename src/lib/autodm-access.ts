import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// AutoDM early access: until Meta approves the app (AUTODM_OPEN=true), a Pro
// creator can connect only after the admin has added their Facebook account
// as a Tester in the Meta app and marked their request invited.

export type AccessRequest = { ig_username: string; facebook: string; status: "pending" | "invited" | "declined"; created_at: string };

export async function autodmAccess(profile: { id: string; is_admin: boolean }) {
  const open = env.autodmOpen();
  const { data } = await createAdminClient()
    .from("autodm_access_requests")
    .select("ig_username, facebook, status, created_at")
    .eq("creator_id", profile.id)
    .maybeSingle<AccessRequest>();
  return { open, request: data ?? null, canConnect: open || profile.is_admin || data?.status === "invited" };
}
