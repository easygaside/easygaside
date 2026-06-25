import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://easygaside.tech";

/** /sitemap.xml — the public, indexable pages. Submit this in Google Search Console. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/beta", priority: 0.9 },
    { path: "/styleshopping", priority: 0.7 },
    { path: "/login", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];
  return pages.map((p) => ({
    url: `${SITE}${p.path}`,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}
