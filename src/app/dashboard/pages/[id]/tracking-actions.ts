"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendMetaEvent } from "@/lib/meta";
import { checkTokenWithMeta, pixelSchema } from "@/lib/meta-settings";
import type { ActionState } from "../../actions";
import { hasCreatorPlan } from "@/lib/plans";

// RLS on payment_pages makes this return null for pages the creator doesn't own.
async function ownedPage(pageId: string) {
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data } = await supabase.from("payment_pages").select("id, slug").eq("id", pageId).eq("creator_id", profile.id).maybeSingle();
  return data ? { profile, page: data } : null;
}

const pageIdSchema = z.uuid();

// Gives one page its own Meta pixel. Pixel ID is required, the token is
// optional, same rules as the account-level settings.
export async function savePageTracking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pageId = pageIdSchema.safeParse(formData.get("page_id"));
  if (!pageId.success) return { error: "Invalid page" };
  const owned = await ownedPage(pageId.data);
  if (!owned) return { error: "Page not found" };
  if (!hasCreatorPlan(owned.profile)) return { error: "Meta tracking is part of the Creator plan." };

  const parsed = pixelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;
  if (!input.pixel_id) return { error: "Add the Pixel ID for this page" };

  const db = createAdminClient();
  const { data: current } = await db.from("page_pixel_settings").select("pixel_id, capi_token_encrypted").eq("page_id", pageId.data).maybeSingle();

  // A blank token field keeps the saved token unless "remove token" is ticked;
  // the token is never sent back to the browser.
  const removeToken = formData.get("remove_token") === "on" && !input.capi_token;
  const token = removeToken ? "" : input.capi_token || (current?.capi_token_encrypted ? decrypt(current.capi_token_encrypted) : "");

  if (token && input.test_event_code && (input.capi_token || current?.pixel_id !== input.pixel_id)) {
    const problem = await checkTokenWithMeta(input.pixel_id, token, input.test_event_code);
    if (problem) return { error: `Meta didn't accept this token for pixel ${input.pixel_id}: ${problem}` };
  }

  const { error } = await db.from("page_pixel_settings").upsert(
    {
      page_id: pageId.data,
      pixel_id: input.pixel_id,
      capi_token_encrypted: input.capi_token ? encrypt(input.capi_token) : removeToken ? null : (current?.capi_token_encrypted ?? null),
      test_event_code: input.test_event_code || null,
    },
    { onConflict: "page_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pages/${pageId.data}`);
  if (!token) return { ok: "Saved. This page now uses its own pixel (browser events only)." };
  return { ok: input.test_event_code ? "Saved. This page uses its own pixel, in test mode." : "Saved. This page now uses its own pixel." };
}

// Back to the account pixel from Settings.
export async function switchToAccountPixel(pageId: string): Promise<ActionState> {
  const owned = await ownedPage(pageId);
  if (!owned) return { error: "Page not found" };
  const { error } = await createAdminClient().from("page_pixel_settings").delete().eq("page_id", pageId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pages/${pageId}`);
  return { ok: "This page now uses your account pixel." };
}

export async function sendPageTestEvent(pageId: string): Promise<ActionState> {
  const owned = await ownedPage(pageId);
  if (!owned) return { error: "Page not found" };
  if (!hasCreatorPlan(owned.profile)) return { error: "Meta tracking is part of the Creator plan." };
  const { data: settings } = await createAdminClient().from("page_pixel_settings").select("test_event_code").eq("page_id", pageId).maybeSingle();
  // Without the creator's test code this would land in their real data.
  if (!settings?.test_event_code) return { error: "Add a test event code first, so the test doesn't count as a real visit." };

  const result = await sendMetaEvent(
    { creatorId: owned.profile.id, pageId },
    {
      eventName: "PageView",
      eventId: `test_${crypto.randomUUID()}`,
      tracking: { source_url: `${env.appUrl()}/p/${owned.page.slug}`, user_agent: "reviewlabs-test", client_ip: "127.0.0.1" },
    },
  );
  if (result.status === "skipped") return { error: "Test events are sent from our server, so they need this pixel's Conversions API token" };
  if (result.status === "failed") return { error: `Meta rejected the event: ${JSON.stringify(result.response ?? result.error)}` };
  return { ok: "Test event sent to this page's pixel. Check the Test events tab in Events Manager." };
}
