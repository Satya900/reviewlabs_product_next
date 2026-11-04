import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/broadcasts";

// One-click unsubscribe (List-Unsubscribe-Post), used by Gmail and others.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const done = await unsubscribeByToken(token);
  return NextResponse.json({ ok: !!done }, { status: done ? 200 : 404 });
}
