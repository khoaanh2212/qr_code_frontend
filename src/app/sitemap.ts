import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/** Public pages only; private pages are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${config.siteUrl}/`, changeFrequency: "weekly", priority: 1 }];
}
