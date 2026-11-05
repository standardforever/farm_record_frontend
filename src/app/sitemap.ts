import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://oko-livestock.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/register", "/login"].map((p) => ({ url: `${SITE}${p}`, changeFrequency: "monthly", priority: p ? 0.5 : 1 }));
}
