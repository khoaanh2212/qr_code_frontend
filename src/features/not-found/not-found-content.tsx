"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, localizePath, splitLocale, type Locale } from "@/i18n/config";
import { NOT_FOUND_MESSAGES } from "@/i18n/not-found";

/**
 * The 404 has no route, so the server renders English; in the browser the text switches to the
 * language of the URL ("/vi/nope" -> Vietnamese) and <html lang> follows.
 */
export function NotFoundContent() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const found = splitLocale(window.location.pathname).locale;
    document.documentElement.lang = found;
    // Reading the URL is only possible after hydration; one extra render on a 404 is fine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(found);
  }, []);

  const t = NOT_FOUND_MESSAGES[locale];
  return (
    <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <a href={localizePath(locale, "/")} className="underline">
        {t.home}
      </a>
    </main>
  );
}
