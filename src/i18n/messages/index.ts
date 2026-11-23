import type { Locale } from "../config";
import type { Messages } from "./en";

export type { Messages } from "./en";

/** Loaded on demand so a page only bundles its own locale. */
const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("./en").then((m) => m.en),
  vi: () => import("./vi").then((m) => m.vi),
  es: () => import("./es").then((m) => m.es),
  de: () => import("./de").then((m) => m.de),
  fr: () => import("./fr").then((m) => m.fr),
  pt: () => import("./pt").then((m) => m.pt),
};

export function loadMessages(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}
