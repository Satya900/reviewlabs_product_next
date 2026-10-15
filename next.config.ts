import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nobody may frame our pages (clickjacking). Razorpay's checkout frames itself inside us, which is unaffected.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Payment, dashboard and download pages are all per-request, so we keep
  // the classic dynamic rendering model instead of Cache Components.
  serverExternalPackages: ["razorpay", "sharp"],
  // Lets the dev server answer through a Cloudflare quick tunnel (HTTPS testing). Ignored in production.
  allowedDevOrigins: ["*.trycloudflare.com"],
  poweredByHeader: false,
  // Creator storefronts live at /@handle; the page itself is /s/[handle].
  async rewrites() {
    return [{ source: "/@:handle", destination: "/s/:handle" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private pages and download links should never be cached or indexed.
      {
        source: "/(dashboard|admin|d|login|auth)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
