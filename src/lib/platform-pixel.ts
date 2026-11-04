// Shared by server and browser code for Reviewlabs' own Meta pixel.

// Reviewlabs' pixel ID. Unset = our own tracking is off.
export const platformPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || null;

// Set by the server after a signup ("EventName:eventId"); the next page fires
// the browser half with the same ID once and clears it.
export const PLATFORM_EVENT_COOKIE = "rl_px_event";
