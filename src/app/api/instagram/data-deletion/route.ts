import crypto from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { parseSignedRequest } from "@/lib/meta-signature";

// Meta's data deletion callback (App Dashboard > App settings > Basic): sent
// when someone removes our app in their Facebook or Instagram settings and
// asks for their data to be deleted. Creators can also delete everything at
// once with "Disconnect" on the AutoDM page.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const data = parseSignedRequest(env.metaAppSecret(), String(form?.get("signed_request") ?? ""));
  if (!data) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const code = crypto.randomBytes(8).toString("hex");
  // The request names a Meta user, not an Instagram account we can match on,
  // so it's handled by hand within 30 days.
  Sentry.captureMessage(`Instagram data deletion request ${code}`, { level: "warning", extra: { metaUserId: String(data.user_id ?? "") } });
  console.warn(`[instagram/data-deletion] request ${code} for Meta user ${String(data.user_id ?? "")}`);
  return NextResponse.json({ url: `${env.appUrl()}/data-deletion?code=${code}`, confirmation_code: code });
}
