import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { createToken, hashEmail, readToken, type VerificationClaim } from "@/lib/verification-token";

// Creators sign in straight away and verify their email later (see migration
// 0019). The link carries a signed, expiring token (src/lib/verification-token.ts).

function signingKey(): Buffer {
  // Separate key per purpose, derived from the app's encryption key.
  return crypto.createHmac("sha256", Buffer.from(env.encryptionKey(), "base64")).update("email-verification:v1").digest();
}

export type { VerificationClaim };

export function createVerificationToken(userId: string, email: string): string {
  return createToken(signingKey(), userId, email);
}

export function readVerificationToken(token: string): VerificationClaim | null {
  return readToken(signingKey(), token);
}

export function emailMatches(claim: VerificationClaim, email: string): boolean {
  return claim.emailHash === hashEmail(email);
}

export async function sendVerificationEmail(user: { id: string; email: string; name?: string | null }): Promise<void> {
  const link = `${env.appUrl()}/auth/verify-email?t=${createVerificationToken(user.id, user.email)}`;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const hello = user.name ? `Hi ${user.name.split(" ")[0]},` : "Hi,";
  const lines = [
    hello,
    "Confirm this is your email so you can publish your pages and get paid. It takes one click.",
  ];
  await sendEmail({
    to: user.email,
    subject: "Verify your email for Reviewlabs",
    html: `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  <p style="margin:0;font-size:14px;color:#7c828a;">Reviewlabs</p>
  <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">Verify your email</h1>
  ${lines.map((l) => `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(l)}</p>`).join("")}
  <p style="margin:24px 0 0 0;"><a href="${link}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:100px;">Verify my email</a></p>
  <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#7c828a;">The link works for 7 days. If you didn't create a Reviewlabs account, you can ignore this email.</p>
</div></div>`,
    text: [...lines, `Verify your email: ${link}`, "The link works for 7 days. If you didn't create a Reviewlabs account, you can ignore this email."].join("\n\n"),
  });
}
