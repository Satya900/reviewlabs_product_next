// Which ad brought a creator to Reviewlabs. Pure, so the proxy, the signup
// action and the tests can share it.
//
// The proxy stores two cookies when someone lands from a link with ?fbclid= or
// ?utm_source=: _fbc (the Meta ad click, in the format the Pixel uses, so
// signups still match the ad when an ad blocker or in-app browser stops the
// Pixel) and rl_attr (the UTM tags, saved on the profile at signup).

export const FBC_COOKIE = "_fbc";
export const ATTR_COOKIE = "rl_attr";
export const CLICK_MAX_AGE = 90 * 86_400; // Meta's own lifetime for _fbc

// fbclid values are URL-safe; anything else isn't a real click ID.
const CLICK_ID = /^[A-Za-z0-9_-]{10,500}$/;

// The new _fbc value, or null when the current one already holds this click
// (so its original timestamp is kept) or the click ID looks wrong.
export function fbcFor(fbclid: string | null, current: string | undefined, now = Date.now()): string | null {
  if (!fbclid || !CLICK_ID.test(fbclid)) return null;
  if (current?.split(".").slice(3).join(".") === fbclid) return null;
  return `fb.1.${now}.${fbclid}`;
}

export type Attribution = {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing: string;
  at: string;
};

const UTM_KEYS = { source: "utm_source", medium: "utm_medium", campaign: "utm_campaign", content: "utm_content", term: "utm_term" } as const;

// Ads Manager fills these from {{campaign.name}} etc., so keep them readable
// but bounded.
function clean(value: string | null | undefined, max = 120): string | undefined {
  const v = value?.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return v || undefined;
}

// The visit's attribution, or null for a visit without UTM tags or an ad click
// (which keeps whatever an earlier ad visit stored: last paid touch wins).
// A Meta click without UTM tags still counts, as source "meta".
export function attributionFrom(url: URL, now = new Date()): Attribution | null {
  const q = url.searchParams;
  const source = clean(q.get(UTM_KEYS.source), 60)?.toLowerCase() ?? (CLICK_ID.test(q.get("fbclid") ?? "") ? "meta" : undefined);
  if (!source) return null;
  const a: Attribution = { source, landing: url.pathname.slice(0, 200), at: now.toISOString() };
  for (const key of ["medium", "campaign", "content", "term"] as const) {
    const v = clean(q.get(UTM_KEYS[key]));
    if (v) a[key] = v;
  }
  return a;
}

// Reads the rl_attr cookie back, ignoring anything that isn't ours.
export function parseAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v?.source !== "string" || typeof v.landing !== "string" || typeof v.at !== "string") return null;
    const a: Attribution = { source: clean(v.source, 60) ?? "other", landing: v.landing.slice(0, 200), at: v.at.slice(0, 40) };
    for (const key of ["medium", "campaign", "content", "term"] as const) {
      const s = typeof v[key] === "string" ? clean(v[key] as string) : undefined;
      if (s) a[key] = s;
    }
    return a;
  } catch {
    return null;
  }
}

// "facebook / paid / Launch: reels" for the admin table.
export function attributionLabel(a: Pick<Attribution, "source" | "medium" | "campaign"> | null | undefined): string {
  if (!a) return "Direct or unknown";
  return [a.source, a.medium, a.campaign].filter(Boolean).join(" / ");
}
