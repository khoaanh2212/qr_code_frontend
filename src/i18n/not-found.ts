import type { Locale } from "./config";

/**
 * Texts of the global 404 page. Kept apart from the message catalogs: that page has no route
 * (and so no locale on the server) and picks the language from the URL in the browser, so it
 * ships all of these, and only these.
 */
export const NOT_FOUND_MESSAGES: Record<Locale, { title: string; home: string }> = {
  en: { title: "Page not found", home: "Go to the home page" },
  vi: { title: "Không tìm thấy trang", home: "Về trang chủ" },
  es: { title: "Página no encontrada", home: "Ir a la página de inicio" },
  de: { title: "Seite nicht gefunden", home: "Zur Startseite" },
  fr: { title: "Page introuvable", home: "Aller à la page d’accueil" },
  pt: { title: "Página não encontrada", home: "Ir para a página inicial" },
};
