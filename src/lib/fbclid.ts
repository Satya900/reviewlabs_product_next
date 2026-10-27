// The _fbc cookie ties a visit to the Meta ad that was clicked. Meta's Pixel
// normally sets it from ?fbclid=, but ad blockers and in-app browsers often
// stop the Pixel loading, and then signups can't be matched to the ad. The
// proxy sets it on the server instead, in the same format the Pixel uses.

export const FBC_COOKIE = "_fbc";
export const FBC_MAX_AGE = 90 * 86_400; // Meta's own lifetime for _fbc

// fbclid values are URL-safe; anything else isn't a real click ID.
const CLICK_ID = /^[A-Za-z0-9_-]{10,500}$/;

// The new _fbc value, or null when the current one already holds this click
// (so its original timestamp is kept) or the click ID looks wrong.
export function fbcFor(fbclid: string | null, current: string | undefined, now = Date.now()): string | null {
  if (!fbclid || !CLICK_ID.test(fbclid)) return null;
  if (current?.split(".").slice(3).join(".") === fbclid) return null;
  return `fb.1.${now}.${fbclid}`;
}
