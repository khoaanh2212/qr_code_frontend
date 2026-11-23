import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { PRIVATE_PREFIXES } from "@/lib/security/csp";

export default function robots(): MetadataRoute.Robots {
  return {
    // Whole segments only ("/app" and "/app/...", not "/apple"), as in surfaceFor. Private pages
    // also send `X-Robots-Tag: noindex`, which crawlers only see where robots.txt lets them in.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PREFIXES.flatMap((p) => [`${p}$`, `${p}/`]),
    },
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
