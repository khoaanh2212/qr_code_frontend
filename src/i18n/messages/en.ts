/**
 * English messages: the reference catalog. Every other locale must have exactly these keys
 * (`satisfies Messages`), so a missing translation fails the type check.
 * Placeholders such as {name} are filled with `format` from src/i18n/config.ts.
 */
export const en = {
  nav: {
    login: "Log in",
    signup: "Sign up",
    dashboard: "Dashboard",
    language: "Language",
  },
  footer: {
    staticForever: "Static QR codes are yours and keep working forever.",
  },
  home: {
    title: "Free QR code generator",
    description: "Create free QR codes for links, Wi-Fi, contacts and more.",
    intro:
      "Create QR codes for links, text, Wi-Fi, contacts, email, SMS and phone numbers. No account needed.",
  },
  auth: {
    loginTitle: "Log in",
    registerTitle: "Create an account",
    forgotPasswordTitle: "Forgot password",
    resetPasswordTitle: "Set a new password",
    verifyEmailTitle: "Verify your email",
  },
  session: {
    loading: "Loading…",
    loadFailed: "We could not load your account.",
    retry: "Try again",
  },
  dashboard: {
    welcome: "Welcome, {name}",
  },
};

export type Messages = typeof en;
