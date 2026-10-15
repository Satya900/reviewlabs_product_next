// Storefront rules shared by the dashboard and the public page.

export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

// Names that would be confusing or impersonate the platform.
export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "api", "app", "auth", "billing", "blog", "careers", "checkout", "contact", "custom",
  "dashboard", "help", "home", "invoice", "legal", "login", "logout", "me", "official", "pages", "pay", "payment",
  "pricing", "privacy", "refund", "reviewlabs", "root", "security", "settings", "signup", "staff", "store",
  "support", "system", "team", "terms", "veyrn", "veyrnlabs", "www",
]);

export const SOCIALS = [
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/yourname" },
  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@yourname" },
  { key: "x", label: "X (Twitter)", placeholder: "x.com/yourname" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourname" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourname" },
  { key: "telegram", label: "Telegram", placeholder: "t.me/yourname" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "Phone number, e.g. 9876543210" },
  { key: "website", label: "Website", placeholder: "yourwebsite.com" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
] as const;

export type SocialKey = (typeof SOCIALS)[number]["key"];

// Turns what a creator typed into a safe link, or null if it isn't usable.
export function socialHref(key: SocialKey, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (key === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? `mailto:${value}` : null;
  if (key === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
  }
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
