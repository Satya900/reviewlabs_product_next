import "server-only";
import crypto from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPublicImage } from "@/lib/safe-fetch";

const MAX_DOWNLOAD = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;

// Copies an image from another website into the creator's own public storage,
// so their page doesn't break if the other site removes it. The image is
// re-encoded, which strips metadata and anything that isn't image data.
export async function copyImageToStorage(url: string, creatorId: string): Promise<string> {
  const { bytes, contentType } = await fetchPublicImage(url, MAX_DOWNLOAD);
  const animated = contentType === "image/gif";
  const out = animated
    ? await sharp(bytes, { animated: true }).resize({ width: MAX_WIDTH, withoutEnlargement: true }).gif().toBuffer()
    : await sharp(bytes).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const ext = animated ? "gif" : "webp";
  const path = `${creatorId}/media/${crypto.randomUUID()}.${ext}`;

  const storage = createAdminClient().storage.from("page-covers");
  const { error } = await storage.upload(path, out, { contentType: animated ? "image/gif" : "image/webp", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return storage.getPublicUrl(path).data.publicUrl;
}
