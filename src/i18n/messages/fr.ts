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
  generator: {
    loading: "Chargement…",
    typesLabel: "Type de QR code",
    types: {
      url: "Site web",
      text: "Texte",
      wifi: "Wi-Fi",
      vcard: "Contact",
      email: "E-mail",
      sms: "SMS",
      phone: "Téléphone",
    },
    fields: {
      url: {
        url: { label: "Adresse web", help: "Commence par https:// ou http://." },
      },
      text: {
        text: { label: "Texte", help: "" },
      },
      wifi: {
        ssid: { label: "Nom du réseau (SSID)", help: "32 octets maximum." },
        password: { label: "Mot de passe", help: "WPA : de 8 à 63 caractères. Pour un réseau ouvert, choisissez Sécurité : Aucune." },
        encryption: { label: "Sécurité", help: "" },
        hidden: { label: "Réseau masqué", help: "" },
      },
      vcard: {
        first_name: { label: "Prénom", help: "Indiquez un prénom, un nom ou une organisation." },
        last_name: { label: "Nom", help: "" },
        organization: { label: "Organisation", help: "" },
        title: { label: "Fonction", help: "" },
        phone: { label: "Téléphone", help: "De 3 à 15 chiffres, éventuellement précédés de +." },
        email: { label: "E-mail", help: "" },
        website: { label: "Site web", help: "Commence par https:// ou http://." },
        address: { label: "Adresse", help: "" },
        note: { label: "Note", help: "" },
      },
      email: {
        to: { label: "Destinataire", help: "" },
        subject: { label: "Objet", help: "" },
        body: { label: "Message", help: "" },
      },
      sms: {
        phone: { label: "Numéro de téléphone", help: "De 3 à 15 chiffres, éventuellement précédés de +." },
        message: { label: "Message", help: "" },
      },
      phone: {
        phone: { label: "Numéro de téléphone", help: "De 3 à 15 chiffres, éventuellement précédés de +." },
      },
    },
    options: {
      WPA: "WPA/WPA2/WPA3",
      WEP: "WEP",
      nopass: "Aucune (réseau ouvert)",
    },
    sections: {
      content: "Contenu",
      design: "Apparence",
      download: "Télécharger",
    },
    design: {
      fg: "Couleur du code",
      bg: "Arrière-plan",
      ecc: "Correction d’erreurs",
      eccLevels: {
        L: "Faible (7 %)",
        M: "Moyenne (15 %)",
        Q: "Quartile (25 %)",
        H: "Élevée (30 %)",
      },
      margin: "Marge (modules)",
      lowContrast: "Utilisez une couleur foncée sur un fond clair avec un contraste d’au moins 3:1, sinon les lecteurs risquent de ne pas lire le code.",
      logo: "Logo",
      logoHelp: "PNG ou JPEG, 1 Mo et 1024 × 1024 px maximum.",
      logoUpload: "Importer un logo",
      colorPicker: "Choisir {name}",
      colorInvalid: "Saisissez une couleur comme #1A2B3C.",
      logoRemove: "Retirer le logo",
      logoEcc: "Avec un logo, la correction d’erreurs élevée est utilisée pour que le code reste lisible.",
      logoType: "Choisissez une image PNG ou JPEG.",
      logoSize: "Le logo ne doit pas dépasser 1 Mo.",
    },
    preview: {
      title: "Aperçu",
      empty: "Saisissez le contenu pour voir votre QR code.",
      updating: "Mise à jour…",
      alt: "Aperçu de votre QR code",
    },
    download: {
      format: "Format",
      size: "Taille (px)",
      sizeHelp: "De {min} à {max} px.",
      button: "Télécharger en {format}",
      working: "Préparation…",
    },
    validation: {
      required: "Obligatoire.",
      invalid: "Vérifiez cette valeur.",
    },
    errors: {
      loadTypes: "Impossible de charger les types de QR code.",
      retry: "Réessayer",
      rateLimited: "Trop de demandes. Réessayez dans {seconds} secondes.",
      busy: "Le serveur est occupé. Réessayez dans un instant.",
      network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
      tooLarge: "La demande est trop volumineuse. Essayez un logo plus petit.",
      generic: "Une erreur s’est produite. Réessayez.",
    },
  },
  dashboard: {
    welcome: "Bienvenue, {name}",
  },
} satisfies Messages;
