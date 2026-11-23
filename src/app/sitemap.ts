import type { MetadataRoute } from "next";
import { LOCALES, localizePath } from "@/i18n/config";
import { config } from "@/lib/config";

/** Public pages only, one entry per locale with its alternates; private pages are never listed. */
const PUBLIC_PATHS = ["/"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, `${config.siteUrl}${localizePath(l, path)}`]));
    return LOCALES.map((locale) => ({
      url: `${config.siteUrl}${localizePath(locale, path)}`,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
