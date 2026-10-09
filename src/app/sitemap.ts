import type { MetadataRoute } from "next";

const routes = ["", "/features", "/how-it-works", "/pricing", "/about", "/contact", "/terms", "/privacy", "/refund-policy", "/delivery-policy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return routes.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
