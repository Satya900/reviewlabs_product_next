import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { createState, readState } from "@/lib/meta-signature";

// The Instagram login round trip: a signed state plus a cookie nonce, so the
// callback only accepts logins this browser started.

export const STATE_COOKIE = "rl_ig_state";

function stateKey(): Buffer {
  return crypto.createHmac("sha256", Buffer.from(env.encryptionKey(), "base64")).update("instagram-state:v1").digest();
}

export const redirectUri = () => `${env.appUrl()}/api/instagram/callback`;

export function newLoginState(userId: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString("base64url");
  return { state: createState(stateKey(), userId, nonce), nonce };
}

export function checkLoginState(state: string, nonce: string | undefined): string | null {
  return readState(stateKey(), state, nonce);
}
