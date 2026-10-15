import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  plan: "free" | "creator";
  plan_status: "none" | "created" | "active" | "past_due" | "cancelling" | "cancelled" | "halted" | "expired";
  plan_current_period_end: string | null;
  razorpay_subscription_id: string | null;
  commission_bps: number | null;
  plan_interval: "month" | "year" | null;
  intro_used: boolean;
  payout_upi: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_ifsc: string | null;
};

// Verified with the Supabase Auth server, deduplicated per request.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
});

export async function requireCreator(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireCreator();
  if (!profile.is_admin) redirect("/dashboard");
  return profile;
}
