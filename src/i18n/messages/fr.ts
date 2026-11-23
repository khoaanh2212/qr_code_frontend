import type { Messages } from "./en";

export const fr = {
  nav: {
    login: "Se connecter",
    signup: "S’inscrire",
    dashboard: "Tableau de bord",
    language: "Langue",
  },
  footer: {
    staticForever: "Les QR codes statiques vous appartiennent et fonctionnent pour toujours.",
  },
  home: {
    title: "Générateur de QR codes gratuit",
    description: "Créez des QR codes gratuits pour des liens, le Wi-Fi, des contacts et plus encore.",
    intro:
      "Créez des QR codes pour des liens, du texte, le Wi-Fi, des contacts, des e-mails, des SMS et des numéros de téléphone. Aucun compte requis.",
  },
  auth: {
    loginTitle: "Se connecter",
    registerTitle: "Créer un compte",
    forgotPasswordTitle: "Mot de passe oublié",
    resetPasswordTitle: "Définir un nouveau mot de passe",
    verifyEmailTitle: "Vérifiez votre adresse e-mail",
  },
  session: {
    loading: "Chargement…",
    loadFailed: "Impossible de charger votre compte.",
    retry: "Réessayer",
  },
  dashboard: {
    welcome: "Bienvenue, {name}",
  },
} satisfies Messages;
