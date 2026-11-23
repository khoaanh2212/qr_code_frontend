import type { Messages } from "./en";

export const de = {
  nav: {
    login: "Anmelden",
    signup: "Registrieren",
    dashboard: "Dashboard",
    language: "Sprache",
  },
  footer: {
    staticForever: "Statische QR-Codes gehören dir und funktionieren für immer.",
  },
  home: {
    title: "Kostenloser QR-Code-Generator",
    description: "Erstelle kostenlose QR-Codes für Links, WLAN, Kontakte und mehr.",
    intro:
      "Erstelle QR-Codes für Links, Text, WLAN, Kontakte, E-Mail, SMS und Telefonnummern. Kein Konto nötig.",
  },
  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto erstellen",
    forgotPasswordTitle: "Passwort vergessen",
    resetPasswordTitle: "Neues Passwort festlegen",
    verifyEmailTitle: "E-Mail-Adresse bestätigen",
  },
  session: {
    loading: "Wird geladen…",
    loadFailed: "Dein Konto konnte nicht geladen werden.",
    retry: "Erneut versuchen",
  },
  dashboard: {
    welcome: "Willkommen, {name}",
  },
} satisfies Messages;
