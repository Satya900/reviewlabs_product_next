"use server";

import crypto from "node:crypto";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasCreatorPlan } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { htmlToText, sanitizeDescription } from "@/lib/rich-text";
import { copyImageToStorage } from "@/lib/media-copy";
import { LIMITS, descriptionImages, importPayloadSchema, isSuperprofileUrl, planImport } from "@/lib/superprofile-import";

export type ImportResult =
  | { error: string }
  | {
      pageId: string;
      counts: { testimonials: number; faqs: number; questions: number; images: number; offer: boolean; policies: boolean };
      priceSet: boolean;
      notes: string[];
    };

function slugify(input: string) {
  // Trim hyphens after cutting too, or a long title can end in "-" and give "…--ab12".
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").slice(0, 48).replace(/^-+|-+$/g, "") || "page";
}

// Copies up to `limit` images, four at a time. Returns original URL -> our URL.
async function copyImages(urls: string[], creatorId: string): Promise<{ map: Map<string, string>; failed: number }> {
  const map = new Map<string, string>();
  let failed = 0;
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          map.set(url, await copyImageToStorage(url, creatorId));
        } catch (e) {
          failed++;
          console.warn("[import] image", (e as Error).message);
        }
      }
    }),
  );
  return { map, failed };
}

// Creates a DRAFT product page from a Superprofile page the creator owns.
// The data was read in the creator's own browser (a saved .html page);
// it is re-validated and re-cleaned here, never trusted as-is.
export async function importFromSuperprofile(raw: unknown, ownsPage: boolean): Promise<ImportResult> {
  const profile = await requireCreator();
  if (!ownsPage) return { error: "Please confirm this is your own Superprofile page." };
  if (!(await rateLimit(`superprofile-import:${profile.id}`, 10, 3600))) {
    return { error: "You've imported a lot of pages in the last hour. Please try again later." };
  }

  const parsed = importPayloadSchema.safeParse(raw);
  if (!parsed.success) return { error: "We couldn't read that page. Open the product page itself on superprofile.bio and try again." };
  if (parsed.data.url && !isSuperprofileUrl(parsed.data.url)) return { error: "Only pages from superprofile.bio can be imported." };
  const plan = planImport(parsed.data);
  const notes = [...plan.notes];
  const supabase = await createClient();

  // 1. The page itself, as a draft. Plan limits are enforced by the database.
  const slug = `${slugify(plan.title)}-${crypto.randomBytes(2).toString("hex")}`;
  const { data: page, error } = await supabase
    .from("payment_pages")
    .insert({
      creator_id: profile.id,
      title: plan.title,
      slug,
      amount_paise: plan.pricePaise ?? 9900,
      compare_at_paise: plan.compareAtPaise,
      button_label: plan.buttonLabel,
      status: "draft",
      refund_policy: plan.refundPolicy,
      terms: plan.terms,
    })
    .select("id")
    .single();
  if (error || !page) {
    if (error?.message.includes("free_plan_page_limit")) {
      return { error: "The Free plan includes one product page. Upgrade to Creator in Plan and billing to import more pages." };
    }
    return { error: error?.message ?? "Couldn't create the page" };
  }

  // 2. Images, copied into our storage so the page doesn't depend on Superprofile.
  const offerAllowed = hasCreatorPlan(profile);
  const imageUrls = [
    ...(plan.cover ? [plan.cover] : []),
    ...descriptionImages(plan.descriptionHtml),
    ...(plan.offer?.image && offerAllowed ? [plan.offer.image] : []),
    ...plan.testimonials.flatMap((t) => (t.photo ? [t.photo] : [])),
  ];
  const unique = [...new Set(imageUrls)];
  if (unique.length > LIMITS.images) notes.push(`Only the first ${LIMITS.images} images were copied.`);
  const { map: copied, failed } = await copyImages(unique.slice(0, LIMITS.images), profile.id);
  if (failed) notes.push(`${failed} image${failed === 1 ? "" : "s"} couldn't be copied. Add ${failed === 1 ? "it" : "them"} again in the editor.`);

  // Point description images at our copies; ones that failed are dropped by the sanitiser.
  const withOurImages = plan.descriptionHtml.replace(/(<img[^>]+src=")([^"]+)(")/gi, (all, a: string, src: string, b: string) => {
    const ours = copied.get(src.replace(/&amp;/g, "&"));
    return ours ? `${a}${ours}${b}` : all;
  });
  const descriptionHtml = sanitizeDescription(withOurImages).slice(0, 200_000);
  await supabase
    .from("payment_pages")
    .update({
      description_html: descriptionHtml,
      description: htmlToText(descriptionHtml).slice(0, 10000),
      cover_image_url: plan.cover ? copied.get(plan.cover) ?? null : null,
    })
    .eq("id", page.id);

  // 3. Testimonials, FAQs and checkout questions.
  const results = await Promise.all([
    plan.testimonials.length
      ? supabase.from("page_testimonials").insert(
          plan.testimonials.map((t, i) => ({
            page_id: page.id,
            name: t.name,
            comment: t.comment,
            rating: t.rating,
            avatar_face: t.face,
            avatar_url: t.photo ? copied.get(t.photo) ?? null : null,
            position: i,
          })),
        )
      : null,
    plan.faqs.length ? supabase.from("page_faqs").insert(plan.faqs.map((f, i) => ({ page_id: page.id, question: f.question, answer: f.answer, position: i }))) : null,
    plan.fields.length
      ? supabase.from("page_fields").insert(plan.fields.map((f, i) => ({ page_id: page.id, label: f.label, field_type: f.type, required: f.required, options: f.options, position: i })))
      : null,
  ]);
  const [testimonialsError, faqsError, fieldsError] = results.map((r) => r?.error ?? null);
  if (testimonialsError) notes.push("Testimonials couldn't be imported. Add them in the editor.");
  if (faqsError) notes.push("FAQs couldn't be imported. Add them in the editor.");
  if (fieldsError) notes.push("Checkout questions couldn't be imported. Add them in the editor.");
  for (const e of [testimonialsError, faqsError, fieldsError]) if (e) console.error("[import]", e.message);

  // 4. The add-on offer (a Creator plan feature).
  let offerImported = false;
  if (plan.offer) {
    if (!offerAllowed) {
      notes.push("The add-on offer was skipped. Add-on offers are part of the Creator plan.");
    } else {
      const { error: offerError } = await supabase.from("page_offers").insert({
        page_id: page.id,
        headline: plan.offer.headline,
        title: plan.offer.title,
        description: plan.offer.description,
        image_url: plan.offer.image ? copied.get(plan.offer.image) ?? null : null,
        price_paise: plan.offer.pricePaise,
        compare_at_paise: plan.offer.compareAtPaise,
        active: false, // no file yet; the creator turns it on after uploading one
      });
      if (offerError) {
        console.error("[import] offer", offerError.message);
        notes.push("The add-on offer couldn't be imported. Add it in the editor.");
      } else {
        offerImported = true;
        notes.push("The add-on offer is saved but switched off. Upload its file in the editor, then turn it on.");
      }
    }
  }

  // No revalidatePath here: it would re-render this page, and for a Free user who
  // just used their one page the importer (and this result) would be swapped for
  // the upgrade card. The pages list is rendered fresh on every visit anyway.
  return {
    pageId: page.id,
    counts: {
      testimonials: testimonialsError ? 0 : plan.testimonials.length,
      faqs: faqsError ? 0 : plan.faqs.length,
      questions: fieldsError ? 0 : plan.fields.length,
      images: copied.size,
      offer: offerImported,
      policies: Boolean(plan.refundPolicy || plan.terms),
    },
    priceSet: plan.pricePaise !== null,
    notes,
  };
}
