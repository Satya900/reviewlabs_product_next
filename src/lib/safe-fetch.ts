import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

// Fetching URLs that users paste is a classic way to reach internal services
// (SSRF). Only public internet addresses on standard ports are allowed, every
// redirect hop is re-checked, and the body size is capped while streaming.

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only web addresses can be imported");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Unsupported port");
  if (url.username || url.password) throw new Error("Unsupported address");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateIp)) throw new Error("That address isn't allowed");
  return url;
}

export async function fetchPublicImage(raw: string, maxBytes: number): Promise<{ bytes: Buffer; contentType: string }> {
  let current = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; ReviewlabsImageImport/1.0)", accept: "image/*" },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Bad redirect");
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`The image couldn't be downloaded (HTTP ${res.status})`);
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") throw new Error("That link isn't a supported image");
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("That image is too large");

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("That image is too large");
      }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), contentType };
  }
  throw new Error("Too many redirects");
}
