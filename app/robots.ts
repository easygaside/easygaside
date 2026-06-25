import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://easygaside.tech";

/**
 * /robots.txt — allow crawling of the public marketing surface, keep the app + API private.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/projects", "/connect", "/settings", "/waitlist"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
