"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

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

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await rateLimit(`signup:ip:${await ip()}`, 5, 3600))) return tooManyRequests;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${env.appUrl()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) {
    console.error("[signup]", error.message);
    if (/rate limit/i.test(error.message)) return { error: "Too many emails have gone out recently. Please try again in a little while." };
    if (/password/i.test(error.message)) return { error: error.message };
    return { error: "We couldn't create your account right now. Please try again." };
  }
  // Same response whether or not the email already had an account.
  return { sentTo: parsed.data.email };
}

// ---------------------------------------------------------------- sign in

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(72) });

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ipOk = await rateLimit(`login:ip:${await ip()}`, 20, 600);
  const emailOk = await rateLimit(`login:email:${parsed.data.email}`, 8, 600);
  if (!ipOk || !emailOk) return tooManyRequests;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
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
