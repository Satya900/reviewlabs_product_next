// Lead magnet rules shared by the builder, the public page and the API.

export const LEAD_LIMITS = { title: 50, description: 80, button: 25, thankYou: 1000 } as const;

export const COVER_PRESETS = {
  ocean: "linear-gradient(135deg,#0033cc 0%,#0052ff 40%,#7aa5ff 100%)",
  sunset: "linear-gradient(160deg,#ff8a00 0%,#ff3d6e 55%,#8a1fa8 100%)",
  aurora: "linear-gradient(135deg,#0b6e66 0%,#1fbf8f 50%,#c2f970 100%)",
  midnight: "linear-gradient(160deg,#0a0b0d 0%,#1b2140 55%,#4b2fa8 100%)",
  blush: "linear-gradient(135deg,#ffd6e0 0%,#e9c6f5 50%,#c7d7ff 100%)",
} as const;
export type CoverPreset = keyof typeof COVER_PRESETS;
export const COVER_KEYS = Object.keys(COVER_PRESETS) as CoverPreset[];

export type LeadQuestionType = "text" | "textarea" | "number" | "select";
export const QUESTION_TYPES: { value: LeadQuestionType; label: string }[] = [
  { value: "text", label: "Short answer" },
  { value: "textarea", label: "Long answer" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
];

export type LeadQuestion = { id: string; label: string; field_type: LeadQuestionType; required: boolean; options: string[]; position: number };

export type LeadMagnet = {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  description: string;
  button_label: string;
  cover_preset: CoverPreset;
  cover_image_url: string | null;
  collect_phone: boolean;
  phone_required: boolean;
  verify_email: boolean;
  thank_you_message: string;
  redirect_url: string | null;
  recommended_page_id: string | null;
  status: "draft" | "live" | "archived";
  storefront_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadFile = { id: string; file_name: string; size_bytes: number };

// What the public form card needs; also built live from the builder's draft.
export type LeadFormData = {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  coverPreset: CoverPreset;
  coverImageUrl: string | null;
  collectPhone: boolean;
  phoneRequired: boolean;
  verifyEmail: boolean;
  questions: { id: string; label: string; type: LeadQuestionType; required: boolean; options: string[] }[];
  fileCount: number;
  creatorName: string;
  thankYouMessage: string;
  redirectUrl: string | null;
  recommended: { slug: string; title: string; price: string; cover: string | null } | null;
};

export function leadSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "free";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function phoneDigits(raw: string) {
  return raw.replace(/\D/g, "");
}
