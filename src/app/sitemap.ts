import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES, localizePath } from "@/i18n/config";
import { config } from "@/lib/config";
import { TYPE_PAGES } from "@/lib/qr/type-pages";

/** Public pages only, one entry per locale with its alternates; private pages are never listed. */
const PUBLIC_PATHS = ["/", ...TYPE_PAGES.map((p) => `/${p.slug}`)];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) => {
    // Same alternates as the pages' <link rel="alternate"> (src/i18n/metadata.ts), x-default included.
    const languages: Record<string, string> = Object.fromEntries(
      LOCALES.map((l) => [l, `${config.siteUrl}${localizePath(l, path)}`]),
    );
    languages["x-default"] = `${config.siteUrl}${localizePath(DEFAULT_LOCALE, path)}`;
    return LOCALES.map((locale) => ({
      url: `${config.siteUrl}${localizePath(locale, path)}`,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
