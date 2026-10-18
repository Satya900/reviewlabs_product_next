// Shared by server and browser code for Reviewlabs' own Meta pixel.

// Reviewlabs' pixel ID. Unset = our own tracking is off.
export const platformPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || null;

// Set by a server route after a conversion ("EventName:eventId"); the browser
// fires the same event once and clears it.
export const PLATFORM_EVENT_COOKIE = "rl_px_event";
