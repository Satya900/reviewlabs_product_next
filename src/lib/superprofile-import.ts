import sanitizeHtml from "sanitize-html";
import { z } from "zod";

// Turns what public/superprofile-import.js read from a Superprofile page into a
// Reviewlabs draft: our field names, our length limits, our formatting. Pure
// functions only (no database, no network), so it can be tested on its own.

const text = (max: number) => z.string().max(max).catch("");

export const importPayloadSchema = z.object({
  v: z.literal(1),
  url: text(500),
  title: z.string().trim().min(1).max(500),
  description: text(300_000),
  cta: text(100),
  currency: text(10),
  cover: text(2000),
  price: text(40),
  compareAt: text(40),
  testimonials: z
    .array(z.object({ name: text(200), comment: text(2000), rating: z.number().catch(5), photo: text(2000) }))
    .max(50)
    .catch([]),
  faqs: z.array(z.object({ question: text(500), answer: text(5000) })).max(50).catch([]),
  offer: z
    .object({ title: text(300), description: text(5000), cta: text(100), image: text(2000), price: z.number().catch(0), discountedPrice: z.number().catch(0) })
    .nullable()
    .catch(null),
  fields: z
    .array(z.object({ label: text(300), type: text(40), required: z.boolean().catch(false), options: z.array(text(200)).max(50).catch([]) }))
    .max(30)
    .catch([]),
  refundPolicy: text(20_000),
  terms: text(20_000),
});
export type ImportPayload = z.infer<typeof importPayloadSchema>;

// Our limits (see the table checks in the migrations).
export const LIMITS = {
  title: 200,
  buttonLabel: 40,
  testimonials: 20,
  testimonialName: 80,
  testimonialComment: 300,
  faqs: 20,
  faqQuestion: 150,
  faqAnswer: 1000,
  fields: 10,
  fieldLabel: 120,
  offerHeadline: 80,
  offerTitle: 120,
  offerDescription: 300,
  policy: 3000,
  images: 25,
  maxPricePaise: 50_000_000,
} as const;

// Must match FACES in components/face-avatar.tsx.
export type Face = "sunglasses" | "smile" | "wink" | "grin" | "hearts" | "laugh" | "starry" | "calm";

// Only images on Superprofile's own servers are copied.
export function isImportableImage(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)(cosmofeed\.com|superprofile\.bio)$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function isSuperprofileUrl(url: string): boolean {
  try {
    return /(^|\.)superprofile\.bio$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// "₹1,499" / "Rs. 399" / "399.50" -> paise. Null when there's no usable price.
export function parsePricePaise(input: string): number | null {
  const m = input.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const paise = Math.round(Number(m[1]) * 100);
  return paise >= 100 && paise <= LIMITS.maxPricePaise ? paise : null;
}

export function rupeesToPaiseNumber(rupees: number): number | null {
  if (!Number.isFinite(rupees)) return null;
  const paise = Math.round(rupees * 100);
  return paise >= 100 && paise <= LIMITS.maxPricePaise ? paise : null;
}

// Superprofile's emoji avatars ("laughingEmoji", "sunglassEmoji") -> our faces.
export function faceFor(photo: string): Face {
  const p = photo.toLowerCase();
  if (p.includes("sunglass") || p.includes("cool")) return "sunglasses";
  if (p.includes("laugh") || p.includes("joy")) return "laugh";
  if (p.includes("wink")) return "wink";
  if (p.includes("heart") || p.includes("love")) return "hearts";
  if (p.includes("star")) return "starry";
  if (p.includes("grin")) return "grin";
  if (p.includes("smil") || p.includes("happy")) return "smile";
  return "calm";
}

// Name, email and phone are always collected by our checkout, so those
// questions are dropped. Everything else maps to our four field types.
export function mapField(type: string): "text" | "textarea" | "number" | "select" | null {
  const t = type.toLowerCase().replace(/[^a-z]/g, "");
  if (["phone", "phonenumber", "mobile", "email", "name", "fullname", "firstname", "lastname"].includes(t)) return null;
  if (["textarea", "longtext", "longanswer", "paragraph", "multilinetext"].includes(t)) return "textarea";
  if (["number", "numeric", "integer"].includes(t)) return "number";
  if (["select", "dropdown", "radio", "singleselect", "singlechoice", "choice", "options", "multiselect", "checkbox", "multiplechoice"].includes(t)) return "select";
  return "text";
}

// Superprofile policies are Markdown. Ours are plain text shown as written.
export function markdownToPlain(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}[ \t]*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, "$1 ($2)")
    .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clip(value: string, max: number): string {
  const v = value.replace(/\s+$/g, "");
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

function plain(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|div|h[1-6]|li)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Reshapes Superprofile's description HTML into tags our editor supports.
// Our own sanitiser still runs afterwards; this only keeps the meaning
// (big headings, prices struck through, tables) from being lost.
export function convertDescription(html: string): string {
  const flattenedTables = html
    .replace(/<\/t[hd]>\s*<t[hd][^>]*>/gi, " · ")
    .replace(/<tr[^>]*>/gi, "<p>")
    .replace(/<\/tr>/gi, "</p>")
    .replace(/<\/?(table|thead|tbody|tfoot|t[hd])[^>]*>/gi, "");
  return sanitizeHtml(flattenedTables, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr", "span", "img"],
    allowedAttributes: { a: ["href"], img: ["src", "alt"], span: ["style"], p: ["style"], h2: ["style"], h3: ["style"] },
    allowedStyles: { span: { "font-size": [/^\d{1,2}px$/] }, p: { "text-align": [/^(left|center|right|justify)$/] }, h2: { "text-align": [/^(left|center|right|justify)$/] }, h3: { "text-align": [/^(left|center|right|justify)$/] } },
    allowedSchemes: ["https", "mailto"],
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      del: "s",
      strike: "s",
      div: "p",
      figure: "p",
      figcaption: "p",
      // Superprofile sizes text in px; snap to our editor's sizes.
      span: (tagName, attribs) => {
        const size = Number((attribs.style ?? "").match(/font-size:\s*(\d+)px/)?.[1] ?? 0);
        const ours = size >= 24 ? "26px" : size >= 18 ? "20px" : size > 0 && size <= 14 ? "14px" : "";
        const attrs: Record<string, string> = ours ? { style: `font-size: ${ours}` } : {};
        return { tagName, attribs: attrs };
      },
    },
  })
    // Converting div/figure to p can leave empty or nested paragraphs behind.
    .replace(/<p>\s*(<p>)/g, "$1")
    .replace(/(<\/p>)\s*<\/p>/g, "$1")
    .replace(/<p>(\s|&nbsp;|<br \/>)*<\/p>/g, "")
    .trim();
}

export function descriptionImages(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (isImportableImage(url)) urls.add(url);
  }
  return [...urls];
}

export type ImportPlan = {
  title: string;
  pricePaise: number | null;
  compareAtPaise: number | null;
  buttonLabel: string;
  cover: string | null;
  descriptionHtml: string;
  refundPolicy: string;
  terms: string;
  testimonials: { name: string; comment: string; rating: number; face: Face; photo: string | null }[];
  faqs: { question: string; answer: string }[];
  fields: { label: string; type: "text" | "textarea" | "number" | "select"; required: boolean; options: string[] }[];
  offer: { headline: string; title: string; description: string; image: string | null; pricePaise: number; compareAtPaise: number | null } | null;
  // Things we couldn't bring across, shown to the creator before they confirm.
  notes: string[];
};

export function planImport(input: ImportPayload): ImportPlan {
  const notes: string[] = [];

  const pricePaise = parsePricePaise(input.price);
  if (!pricePaise) notes.push("We couldn't read the price. Set it in the editor before publishing.");
  const compare = parsePricePaise(input.compareAt);
  const compareAtPaise = compare && pricePaise && compare > pricePaise ? compare : null;
  if (input.currency && input.currency !== "INR") notes.push(`The page was priced in ${input.currency}. Reviewlabs sells in INR, so check the price.`);

  const testimonials = input.testimonials
    .filter((t) => t.comment.trim() && t.name.trim())
    .map((t) => ({
      name: clip(t.name.trim(), LIMITS.testimonialName),
      comment: clip(t.comment.trim(), LIMITS.testimonialComment),
      rating: Math.min(5, Math.max(1, Math.round(t.rating) || 5)),
      face: faceFor(t.photo),
      photo: isImportableImage(t.photo) ? t.photo : null,
    }));
  if (testimonials.length > LIMITS.testimonials) notes.push(`Only the first ${LIMITS.testimonials} testimonials were kept.`);
  if (input.testimonials.some((t) => t.comment.trim().length > LIMITS.testimonialComment)) notes.push(`Some testimonials were shortened to ${LIMITS.testimonialComment} characters.`);

  const faqs = input.faqs
    .map((f) => ({ question: clip(f.question.trim(), LIMITS.faqQuestion), answer: clip(plain(f.answer), LIMITS.faqAnswer) }))
    .filter((f) => f.question && f.answer);
  if (faqs.length > LIMITS.faqs) notes.push(`Only the first ${LIMITS.faqs} FAQs were kept.`);

  const fields = input.fields
    .map((f) => ({ field: f, type: mapField(f.type) }))
    .filter((x): x is { field: ImportPayload["fields"][number]; type: NonNullable<ReturnType<typeof mapField>> } => x.type !== null && Boolean(x.field.label.trim()))
    .map(({ field, type }) => {
      const options = field.options.map((o) => o.trim()).filter(Boolean);
      return { label: clip(field.label.trim(), LIMITS.fieldLabel), type: type === "select" && !options.length ? ("text" as const) : type, required: field.required, options: type === "select" ? options : [] };
    });
  if (fields.length > LIMITS.fields) notes.push(`Only the first ${LIMITS.fields} checkout questions were kept.`);

  let offer: ImportPlan["offer"] = null;
  if (input.offer && input.offer.title.trim()) {
    const discounted = input.offer.discountedPrice > 0 && input.offer.discountedPrice < input.offer.price;
    const price = rupeesToPaiseNumber(discounted ? input.offer.discountedPrice : input.offer.price);
    if (price) {
      offer = {
        headline: clip(input.offer.cta.trim() || "Yes, add this to my order", LIMITS.offerHeadline),
        title: clip(input.offer.title.trim(), LIMITS.offerTitle),
        description: clip(plain(input.offer.description), LIMITS.offerDescription),
        image: isImportableImage(input.offer.image) ? input.offer.image : null,
        pricePaise: price,
        compareAtPaise: discounted ? rupeesToPaiseNumber(input.offer.price) : null,
      };
    }
  }

  const refundPolicy = markdownToPlain(input.refundPolicy);
  const terms = markdownToPlain(input.terms);
  if (refundPolicy.length > LIMITS.policy || terms.length > LIMITS.policy) notes.push(`Policies were shortened to ${LIMITS.policy} characters. Check the end of each one.`);

  return {
    title: clip(input.title.trim(), LIMITS.title),
    pricePaise,
    compareAtPaise,
    buttonLabel: clip(input.cta.trim() || "Buy now", LIMITS.buttonLabel),
    cover: isImportableImage(input.cover) ? input.cover : null,
    descriptionHtml: convertDescription(input.description),
    refundPolicy: clip(refundPolicy, LIMITS.policy),
    terms: clip(terms, LIMITS.policy),
    testimonials: testimonials.slice(0, LIMITS.testimonials),
    faqs: faqs.slice(0, LIMITS.faqs),
    fields: fields.slice(0, LIMITS.fields),
    offer,
    notes,
  };
}
