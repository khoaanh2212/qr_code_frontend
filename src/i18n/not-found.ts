import type { Locale } from "./config";

/**
 * Texts of the global 404 page. Kept apart from the message catalogs: that page has no route
 * (and so no locale on the server) and picks the language from the URL in the browser, so it
 * ships all of these, and only these.
 */
export interface NotFoundMessages {
  /** The document title. */
  title: string;
  heading: string;
  lead: string;
  create: string;
  codes: string;
  /** The illustration's text alternative. */
  art: string;
  home: string;
  login: string;
  signup: string;
  report: string;
}

export const NOT_FOUND_MESSAGES: Record<Locale, NotFoundMessages> = {
  en: {
    title: "Page not found",
    heading: "We couldn’t find this page",
    lead: "The link may be mistyped, or the page has moved. If you came for a QR code, you can make one right now, no account needed.",
    create: "Create a free QR code",
    codes: "Go to my codes",
    art: "An empty print proof marked 404",
    home: "ProofQR home",
    login: "Log in",
    signup: "Sign up",
    report: "Report a ProofQR link",
  },
  vi: {
    title: "Không tìm thấy trang",
    heading: "Không tìm thấy trang này",
    lead: "Đường dẫn có thể bị gõ sai, hoặc trang đã được chuyển đi. Nếu bạn cần một mã QR, hãy tạo ngay bây giờ, không cần tài khoản.",
    create: "Tạo mã QR miễn phí",
    codes: "Đến mã QR của tôi",
    art: "Bản in thử trống, đánh dấu 404",
    home: "Trang chủ ProofQR",
    login: "Đăng nhập",
    signup: "Đăng ký",
    report: "Báo cáo liên kết ProofQR",
  },
  es: {
    title: "Página no encontrada",
    heading: "No encontramos esta página",
    lead: "Puede que el enlace esté mal escrito o que la página se haya movido. Si venías por un código QR, puedes crear uno ahora mismo, sin cuenta.",
    create: "Crear un código QR gratis",
    codes: "Ir a mis códigos",
    art: "Una prueba de impresión vacía marcada 404",
    home: "Inicio de ProofQR",
    login: "Iniciar sesión",
    signup: "Registrarse",
    report: "Denunciar un enlace de ProofQR",
  },
  de: {
    title: "Seite nicht gefunden",
    heading: "Diese Seite gibt es hier nicht",
    lead: "Vielleicht ist der Link vertippt oder die Seite ist umgezogen. Wenn du einen QR-Code brauchst, erstell ihn gleich jetzt, ohne Konto.",
    create: "Kostenlosen QR-Code erstellen",
    codes: "Zu meinen Codes",
    art: "Ein leerer Druckabzug mit der Markierung 404",
    home: "ProofQR-Startseite",
    login: "Anmelden",
    signup: "Registrieren",
    report: "ProofQR-Link melden",
  },
  fr: {
    title: "Page introuvable",
    heading: "Nous ne trouvons pas cette page",
    lead: "Le lien est peut-être mal saisi, ou la page a été déplacée. Si vous veniez pour un QR code, créez-en un tout de suite, sans compte.",
    create: "Créer un QR code gratuit",
    codes: "Aller à mes codes",
    art: "Une épreuve d’impression vide marquée 404",
    home: "Accueil ProofQR",
    login: "Se connecter",
    signup: "S’inscrire",
    report: "Signaler un lien ProofQR",
  },
  pt: {
    title: "Página não encontrada",
    heading: "Não encontramos esta página",
    lead: "O link pode estar digitado errado ou a página foi movida. Se você veio por um QR Code, crie um agora mesmo, sem conta.",
    create: "Criar um QR Code grátis",
    codes: "Ir para meus códigos",
    art: "Uma prova de impressão vazia marcada 404",
    home: "Início do ProofQR",
    login: "Entrar",
    signup: "Cadastrar-se",
    report: "Denunciar um link do ProofQR",
  },
};
