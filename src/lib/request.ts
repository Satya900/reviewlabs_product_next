import "server-only";

export function clientIp(headers: Headers): string | undefined {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
}
