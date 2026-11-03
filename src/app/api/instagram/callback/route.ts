import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { accountProfile, assignedAccounts, exchangeCode, subscribeWebhooks } from "@/lib/instagram";
import { STATE_COOKIE, checkLoginState, redirectUri } from "@/lib/instagram-connect";

// Meta sends the creator back here after login with a one-time code.
export async function GET(request: NextRequest) {
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard/autodm?ig=${status}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/instagram" });
    return res;
  };
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done("cancelled");

  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL("/login?next=/dashboard/autodm", request.url));
  const userId = checkLoginState(params.get("state") ?? "", request.cookies.get(STATE_COOKIE)?.value);
  const code = params.get("code");
  if (!code || userId !== profile.id) return done("expired");

  let token: string, account;
  try {
    token = await exchangeCode(code, redirectUri());
    const accounts = await assignedAccounts(token);
    if (!accounts.length) return done("no_account");
    // One Instagram account per creator: the first one they chose.
    account = await accountProfile(token, accounts[0].id);
  } catch (e) {
    console.error("[instagram/callback]", (e as Error).message);
    return done("failed");
  }

  const db = createAdminClient();
  const { data: owner } = await db.from("instagram_accounts").select("creator_id").eq("ig_user_id", account.id).maybeSingle();
  if (owner && owner.creator_id !== profile.id) return done("taken");

  // Connecting a different account replaces the old one.
  await db.from("instagram_accounts").delete().eq("creator_id", profile.id).neq("ig_user_id", account.id);
  const { data: saved, error } = await db
    .from("instagram_accounts")
    .upsert(
      {
        creator_id: profile.id,
        ig_user_id: account.id,
        username: account.username ?? null,
        name: account.name ?? null,
        profile_picture_url: account.profile_picture_url ?? null,
        config_id: env.metaLoginConfigId(),
        status: "active",
        last_error: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "ig_user_id" },
    )
    .select("id")
    .single();
  if (error || !saved) {
    console.error("[instagram/callback] save", error?.message);
    return done("failed");
  }
  await db.from("instagram_tokens").upsert({ account_id: saved.id, token_encrypted: encrypt(token), updated_at: new Date().toISOString() });

  // Comment notifications. If this fails the account still works through the sync.
  try {
    await subscribeWebhooks(token, account.id);
    await db.from("instagram_accounts").update({ subscribed_at: new Date().toISOString() }).eq("id", saved.id);
  } catch (e) {
    await db.from("instagram_accounts").update({ last_error: `Webhook subscription: ${(e as Error).message}`.slice(0, 500) }).eq("id", saved.id);
  }
  return done("connected");
}
