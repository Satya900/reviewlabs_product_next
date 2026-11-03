import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/meta-signature";
import { commentEvents } from "@/lib/autodm";
import { handleComment } from "@/lib/autodm-runner";

// Meta checks the endpoint once when the webhook is set up in the App Dashboard.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === env.instagramWebhookVerifyToken()) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Comment notifications. Answer fast (Meta retries slow responses) and do the
// work afterwards; duplicate deliveries are ignored per comment.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(env.metaAppSecret(), raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const events = commentEvents(payload);
  if (events.length) {
    after(async () => {
      for (const e of events) {
        await handleComment(e).catch((err) => console.error(`[instagram/webhook] comment ${e.commentId}:`, err));
      }
    });
  }
  return NextResponse.json({ ok: true });
}
