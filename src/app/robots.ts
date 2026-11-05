import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://oko-livestock.vercel.app";

/** Search engines may read the public pages; the app itself is behind sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms", "/login", "/register"], disallow: ["/w/", "/admin", "/app", "/api/", "/invite/", "/onboarding"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
