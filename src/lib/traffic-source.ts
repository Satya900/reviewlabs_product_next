// Where a visit came from, for Pro analytics. Pure, so it runs in the browser
// and in tests. utm_source wins over the referrer; AutoDM links carry
// utm_source=autodm (added by /go/[token]).

export const SOURCES = ["autodm", "instagram", "facebook", "whatsapp", "youtube", "google", "x", "linkedin", "telegram", "email", "storefront", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  autodm: "AutoDM links",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  google: "Google search",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  email: "Email",
  storefront: "Your storefront",
  direct: "Direct or unknown",
  other: "Other websites",
};

const HOSTS: [RegExp, Source][] = [
  [/(^|\.)instagram\.com$|^l\.instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.me$|^l\.facebook\.com$|^lm\.facebook\.com$/, "facebook"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, "x"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)telegram\.(org|me)$|^t\.me$/, "telegram"],
  [/mail\./, "email"],
];

const UTM: Record<string, Source> = {
  autodm: "autodm", instagram: "instagram", ig: "instagram", facebook: "facebook", fb: "facebook", whatsapp: "whatsapp", wa: "whatsapp",
  youtube: "youtube", yt: "youtube", google: "google", twitter: "x", x: "x", linkedin: "linkedin", telegram: "telegram", email: "email", newsletter: "email",
};

export function classifySource(pageUrl: string, referrer: string, ownHost: string): Source {
  try {
    const utm = new URL(pageUrl).searchParams.get("utm_source")?.toLowerCase().trim();
    if (utm) return UTM[utm] ?? "other";
  } catch {}
  if (!referrer) return "direct";
  let ref: URL;
  try { ref = new URL(referrer); } catch { return "direct"; }
  const host = ref.hostname.toLowerCase().replace(/^www\./, "");
  if (host === ownHost.toLowerCase().replace(/^www\./, "")) {
    return ref.pathname.startsWith("/@") || ref.pathname.startsWith("/s/") ? "storefront" : "direct";
  }
  for (const [re, src] of HOSTS) if (re.test(host)) return src;
  return "other";
}
