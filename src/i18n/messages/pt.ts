import type { Messages } from "./en";

export const pt = {
  nav: {
    login: "Entrar",
    signup: "Cadastrar-se",
    dashboard: "Painel",
    language: "Idioma",
  },
  footer: {
    staticForever: "QR Codes estáticos são seus e funcionam para sempre.",
  },
  home: {
    title: "Gerador de QR Code grátis",
    description: "Crie QR Codes grátis para links, Wi-Fi, contatos e muito mais.",
    intro:
      "Crie QR Codes para links, texto, Wi-Fi, contatos, e-mail, SMS e números de telefone. Sem precisar de conta.",
  },
  auth: {
    loginTitle: "Entrar",
    registerTitle: "Criar uma conta",
    forgotPasswordTitle: "Esqueceu a senha",
    resetPasswordTitle: "Definir uma nova senha",
    verifyEmailTitle: "Confirme seu e-mail",
  },
  session: {
    loading: "Carregando…",
    loadFailed: "Não foi possível carregar sua conta.",
    retry: "Tentar novamente",
  },
  dashboard: {
    welcome: "Olá, {name}",
  },
} satisfies Messages;
