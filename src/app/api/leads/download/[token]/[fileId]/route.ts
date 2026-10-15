import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

// Free files from a lead magnet. The token comes from the visitor's response.
export async function GET(request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  if (!/^[0-9a-f]{48}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse("This link isn't valid.", { status: 404 });
  if (!(await rateLimit(`leaddl:${clientIp(request.headers) ?? "unknown"}`, 60, 3600))) return new NextResponse("Too many downloads. Try again later.", { status: 429 });

  const admin = createAdminClient();
  const { data: response } = await admin.from("lead_responses").select("magnet_id").eq("download_token", token).maybeSingle();
  if (!response) return new NextResponse("This link isn't valid.", { status: 404 });
  const { data: file } = await admin.from("lead_magnet_files").select("storage_path, file_name").eq("id", fileId).eq("magnet_id", response.magnet_id).maybeSingle();
  if (!file) return new NextResponse("This file is no longer available.", { status: 404 });

  const { data: signed, error } = await admin.storage.from("product-files").createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (error || !signed) return new NextResponse("Download failed. Please try again.", { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 303);
}
