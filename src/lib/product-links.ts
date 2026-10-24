// Product links (migration 0023). Pure, so it can be unit tested and used on
// the client and the server.

export const MAX_LINKS = 10;

// A clean https URL, or null. Accepts "notion.so/…" without the scheme. Refuses
// anything that isn't a public https address (javascript:, data:, http:,
// localhost, user:password@host).
export function cleanLinkUrl(input: string): string | null {
  let value = input.trim();
  if (!value || value.length > 2000 || /\s/.test(value)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".") || host === "localhost" || /^[\d.]+$/.test(host) || host.startsWith("[")) return null;
  // Percent-encoding (e.g. Hindi in the path) can make it longer than what was typed.
  const clean = url.toString();
  return clean.length <= 2000 ? clean : null;
}

export function linkLabelError(label: string): string | null {
  const l = label.trim();
  if (!l) return "Give the link a name buyers will recognise, like “Notion template”";
  if (l.length > 80) return "Keep the name under 80 characters";
  return null;
}

// Fills in a name from well-known hosts when the creator leaves it empty.
export function suggestLinkLabel(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const known: [RegExp, string][] = [
    [/(^|\.)notion\.(so|site)$/, "Notion template"],
    [/^drive\.google\.com$|^docs\.google\.com$/, "Google Drive"],
    [/(^|\.)canva\.com$/, "Canva template"],
    [/^t\.me$|(^|\.)telegram\.(me|org)$/, "Telegram group"],
    [/^chat\.whatsapp\.com$/, "WhatsApp group"],
    [/(^|\.)dropbox\.com$/, "Dropbox folder"],
    [/(^|\.)figma\.com$/, "Figma file"],
    [/(^|\.)youtube\.com$|^youtu\.be$/, "Video"],
    [/(^|\.)discord\.(gg|com)$/, "Discord server"],
  ];
  return known.find(([re]) => re.test(host))?.[1] ?? "Access link";
}
