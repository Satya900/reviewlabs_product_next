"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVerificationEmail } from "@/lib/email-verification";
import { getProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { PLATFORM_EVENT_COOKIE } from "@/lib/platform-pixel";
import { platformEventIds, sendRegistrationEvent, trackingFromHeaders } from "@/lib/platform-meta";

export type AuthState = { error?: string; ok?: string; unverifiedEmail?: string; sentTo?: string } | null;

const email = z.email("Enter a valid email").max(200).transform((v) => v.trim().toLowerCase());
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function ip() {
  return clientIp(await headers()) ?? "unknown";
}

// ---------------------------------------------------------------- sign up

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email,
  password,
});

// Instant signup: the account is created already confirmed, so the creator lands
// in the dashboard straight away. Their email is verified afterwards with our own
// link (profiles.email_verified_at); until then they can build but not sell.
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await rateLimit(`signup:ip:${await ip()}`, 5, 3600))) return tooManyRequests;

  const { data: created, error } = await createAdminClient().auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name },
  });
  if (error || !created.user) {
    if (error?.code === "email_exists" || /already been registered|already exists/i.test(error?.message ?? "")) {
      return { error: "An account with this email already exists. Log in instead, or reset your password if you've forgotten it." };
    }
    if (error?.code === "weak_password" || /password/i.test(error?.message ?? "")) return { error: error?.message };
    console.error("[signup]", error?.message);
    return { error: "We couldn't create your account right now. Please try again." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (signInError) {
    console.error("[signup] sign in", signInError.message);
    redirect("/login");
  }
  const user = { id: created.user.id, email: parsed.data.email, name: parsed.data.name };
  after(() => sendVerificationEmail(user).catch((e) => console.error("[signup] verification email", (e as Error).message)));
  // The signup is our ads' conversion, sent now while we still have the ad
  // click (_fbc) from this browser. The cookie lets the next page fire the
  // browser Pixel half with the same event ID, so Meta counts it once.
  const tracking = trackingFromHeaders(await headers());
  after(() => sendRegistrationEvent(user.id, tracking).catch((e) => console.warn("[signup] registration event:", e)));
  (await cookies()).set(PLATFORM_EVENT_COOKIE, `CompleteRegistration:${platformEventIds.registration(user.id)}`, { path: "/", maxAge: 600, sameSite: "lax" });
  // Step 2: the bank account for payouts (skippable), then the dashboard.
  redirect("/dashboard/setup/payouts?welcome=1");
}

// ---------------------------------------------------------------- sign in

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(72) });

// Accounts created before instant signup that never clicked Supabase's link
// can't sign in. Confirm them at the auth level so the password works; their
// email stays unverified (profiles.email_verified_at) until they verify it.
async function confirmLegacyAccount(email: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("id").eq("email", email).is("email_verified_at", null).maybeSingle();
  if (!profile) return false;
  const { error } = await db.auth.admin.updateUserById(profile.id, { email_confirm: true });
  if (error) console.error("[login] confirm legacy account", error.message);
  return !error;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ipOk = await rateLimit(`login:ip:${await ip()}`, 20, 600);
  const emailOk = await rateLimit(`login:email:${parsed.data.email}`, 8, 600);
  if (!ipOk || !emailOk) return tooManyRequests;

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error && /not confirmed/i.test(error.message) && (await confirmLegacyAccount(parsed.data.email))) {
    ({ error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password }));
  }
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { error: "Please verify your email first. Check your inbox for the link.", unverifiedEmail: parsed.data.email };
    }
    if (/invalid login credentials/i.test(error.message)) return { error: "Wrong email or password." };
    console.error("[login]", error.message);
    return { error: "We couldn't sign you in right now. Please try again." };
  }
  redirect(safeNext(formData.get("next")));
}

// ---------------------------------------------------------------- resend verification

export async function resendVerification(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email" };
  if (!(await rateLimit(`verify-resend:${parsed.data}`, 3, 3600))) return tooManyRequests;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${env.appUrl()}/auth/confirm?next=/dashboard` },
  });
  if (error) console.error("[verify-resend]", error.message);
  return { sentTo: parsed.data };
}

// From the dashboard banner: (re)send the verification link to the signed-in creator.
export async function sendMyVerificationEmail(): Promise<AuthState> {
  const profile = await getProfile();
  if (!profile) return { error: "Please log in again." };
  if (profile.email_verified_at) return { ok: "Your email is already verified." };
  if (!(await rateLimit(`verify-send:${profile.id}`, 5, 3600))) {
    return { error: "We've sent a few links already. Check your inbox and spam folder, or try again in an hour." };
  }
  try {
    await sendVerificationEmail(profile);
  } catch (e) {
    console.error("[verify-send]", (e as Error).message);
    return { error: "We couldn't send the email right now. Please try again in a minute." };
  }
  return { sentTo: profile.email };
}

// ---------------------------------------------------------------- password reset

export async function sendPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email" };
  const emailOk = await rateLimit(`reset:email:${parsed.data}`, 3, 3600);
  const ipOk = await rateLimit(`reset:ip:${await ip()}`, 10, 3600);
  if (!emailOk || !ipOk) return tooManyRequests;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.appUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error) console.error("[reset]", error.message);
  // Same answer either way, so this can't be used to find accounts.
  return { sentTo: parsed.data };
}

const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match", path: ["confirm"] });

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Ask for a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/different from the old/i.test(error.message)) return { error: "Choose a password different from your old one." };
    return { error: error.message };
  }
  redirect("/dashboard?password=updated");
}
