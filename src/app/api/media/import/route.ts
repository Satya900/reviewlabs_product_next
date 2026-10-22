import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { copyImageToStorage } from "@/lib/media-copy";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedImageSrc } from "@/lib/rich-text";

export const maxDuration = 30;

const schema = z.object({ url: z.url().max(4000) });

// Copies an image pasted from another website into the creator's own storage,
// so it shows on their page and doesn't break if the other site removes it.
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!(await rateLimit(`media-import:${profile.id}`, 60, 600))) {
    return NextResponse.json({ error: "Too many images at once. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid image address" }, { status: 400 });
  if (isAllowedImageSrc(parsed.data.url)) return NextResponse.json({ url: parsed.data.url });

  try {
    return NextResponse.json({ url: await copyImageToStorage(parsed.data.url, profile.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
