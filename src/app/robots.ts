import type { MetadataRoute } from "next";
import { LOCALES, localizePath } from "@/i18n/config";
import { config } from "@/lib/config";
import { PRIVATE_PREFIXES } from "@/lib/security/csp";

export default function robots(): MetadataRoute.Robots {
  // Whole segments only ("/app" and "/app/...", not "/apple"), in every locale, as in
  // surfaceFor. Private pages also send `X-Robots-Tag: noindex`, which crawlers only see where
  // robots.txt lets them in.
  const disallow = LOCALES.flatMap((locale) =>
    PRIVATE_PREFIXES.flatMap((p) => {
      const path = localizePath(locale, p);
      return [`${path}$`, `${path}/`];
    }),
  );
  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
