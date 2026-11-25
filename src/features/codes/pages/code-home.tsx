"use client";

import { redirect, useParams } from "next/navigation";
import { localizePath, type Locale } from "@/i18n/config";

/**
 * `/app/codes/{id}`: a code's home is its insights page, where its header leads to everything
 * else. Kept so earlier links (and bookmarks of the old single page) still arrive somewhere.
 */
export function CodeHome({ locale }: { locale: Locale }): null {
  const { id } = useParams<{ id: string }>();
  redirect(localizePath(locale, `/app/codes/${encodeURIComponent(id)}/insights`));
}
