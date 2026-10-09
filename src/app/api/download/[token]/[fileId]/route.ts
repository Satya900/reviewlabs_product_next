import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const back = new URL(`/d/${encodeURIComponent(token)}`, env.appUrl());

  if (!/^[0-9a-f]{48}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    back.searchParams.set("error", "invalid");
    return NextResponse.redirect(back, 303);
  }

  const admin = createAdminClient();
  const { data } = await admin
    .rpc("consume_download", { p_token: token, p_file_id: fileId })
    .maybeSingle<{ storage_path: string; file_name: string }>();
  if (!data) {
    back.searchParams.set("error", "expired");
    return NextResponse.redirect(back, 303);
  }

  // Short-lived signed URL; the permanent object path never reaches the buyer.
  const { data: signed, error } = await admin.storage
    .from("product-files")
    .createSignedUrl(data.storage_path, 60, { download: data.file_name });
  if (error || !signed) {
    console.error("[download] sign", error);
    back.searchParams.set("error", "unavailable");
    return NextResponse.redirect(back, 303);
  }
  return NextResponse.redirect(signed.signedUrl, 303);
}
