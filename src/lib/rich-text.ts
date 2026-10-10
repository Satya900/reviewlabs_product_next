import sanitizeHtml from "sanitize-html";

// Rich text for product descriptions. Creator HTML is shown on public payment
// pages, so it is cleaned against a strict allowlist on save AND on display.
// Used on the server and in the editor preview, so it must stay universal.

export const FONT_SIZES = [
  { label: "Small", value: "14px" },
  { label: "Normal", value: "" },
  { label: "Large", value: "20px" },
  { label: "Extra large", value: "26px" },
] as const;

export const TEXT_COLORS = ["#0a0b0d", "#5b616e", "#0052ff", "#05b169", "#cf202f", "#f4b000", "#7c3aed", "#db2777"];
export const HIGHLIGHT_COLORS = ["#fff3b0", "#d6f5e3", "#dbe7ff", "#fde2e4", "#ede4ff"];

const allowedFontSizes = FONT_SIZES.map((s) => s.value).filter(Boolean);
const colorPattern = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;

// Images may only come from this project's public storage.
function storagePrefix() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/` : "";
}

// Only images stored in this project's storage are allowed in descriptions.
export function isAllowedImageSrc(src: string | null | undefined): boolean {
  const prefix = storagePrefix();
  return Boolean(prefix && src && src.startsWith(prefix));
}

export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr", "span", "img"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["style"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      span: {
        color: [colorPattern],
        "background-color": [colorPattern],
        "font-size": allowedFontSizes.map((s) => new RegExp(`^${s}$`)),
      },
      p: { "text-align": [/^(left|center|right|justify)$/] },
      h2: { "text-align": [/^(left|center|right|justify)$/] },
      h3: { "text-align": [/^(left|center|right|justify)$/] },
      h4: { "text-align": [/^(left|center|right|justify)$/] },
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { a: ["https", "mailto"], img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      // External links open in a new tab and pass no referrer or ranking.
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSrc(frame.attribs.src),
  }).trim();
}

// Plain-text copy for <meta>, link previews and emails.
export function htmlToText(html: string): string {
  const text = sanitizeHtml(
    (html ?? "").replace(/<\/(p|h2|h3|h4|li|blockquote)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n"),
    { allowedTags: [], allowedAttributes: {} },
  );
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmptyRichText(html: string): boolean {
  return htmlToText(html) === "" && !/<img\s/i.test(html ?? "");
}
