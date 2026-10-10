import crypto from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPublicImage } from "@/lib/safe-fetch";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedImageSrc } from "@/lib/rich-text";

export const maxDuration = 30;

const schema = z.object({ url: z.url().max(4000) });
const MAX_DOWNLOAD = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;

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
    const { bytes, contentType } = await fetchPublicImage(parsed.data.url, MAX_DOWNLOAD);
    // Re-encoding strips metadata and anything that isn't image data.
    const animated = contentType === "image/gif";
    const out = animated
      ? await sharp(bytes, { animated: true }).resize({ width: MAX_WIDTH, withoutEnlargement: true }).gif().toBuffer()
      : await sharp(bytes).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const ext = animated ? "gif" : "webp";
    const path = `${profile.id}/media/${crypto.randomUUID()}.${ext}`;

    const storage = createAdminClient().storage.from("page-covers");
    const { error } = await storage.upload(path, out, { contentType: animated ? "image/gif" : "image/webp", cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ url: storage.getPublicUrl(path).data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
