import type { Messages } from "./en";

export const es = {
  nav: {
    login: "Iniciar sesión",
    signup: "Registrarse",
    dashboard: "Panel",
    language: "Idioma",
  },
  footer: {
    staticForever: "Los códigos QR estáticos son tuyos y funcionan para siempre.",
  },
  home: {
    title: "Generador de códigos QR gratis",
    description: "Crea códigos QR gratis para enlaces, Wi-Fi, contactos y mucho más.",
    intro:
      "Crea códigos QR para enlaces, texto, Wi-Fi, contactos, correo electrónico, SMS y números de teléfono. Sin necesidad de cuenta.",
  },
  auth: {
    loginTitle: "Iniciar sesión",
    registerTitle: "Crear una cuenta",
    forgotPasswordTitle: "¿Olvidaste tu contraseña?",
    resetPasswordTitle: "Establecer una nueva contraseña",
    verifyEmailTitle: "Verifica tu correo electrónico",
  },
  session: {
    loading: "Cargando…",
    loadFailed: "No pudimos cargar tu cuenta.",
    retry: "Reintentar",
  },
  dashboard: {
    welcome: "Hola, {name}",
  },
} satisfies Messages;
