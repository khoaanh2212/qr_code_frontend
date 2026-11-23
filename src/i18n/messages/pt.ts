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
  generator: {
    loading: "Carregando…",
    typesLabel: "Tipo de QR Code",
    types: {
      url: "Site",
      text: "Texto",
      wifi: "Wi-Fi",
      vcard: "Contato",
      email: "E-mail",
      sms: "SMS",
      phone: "Telefone",
    },
    fields: {
      url: {
        url: { label: "Endereço do site", help: "Começa com https:// ou http://." },
      },
      text: {
        text: { label: "Texto", help: "" },
      },
      wifi: {
        ssid: { label: "Nome da rede (SSID)", help: "Até 32 bytes." },
        password: { label: "Senha", help: "WPA: de 8 a 63 caracteres. Para uma rede aberta, escolha Segurança: Nenhuma." },
        encryption: { label: "Segurança", help: "" },
        hidden: { label: "Rede oculta", help: "" },
      },
      vcard: {
        first_name: { label: "Nome", help: "Informe um nome, sobrenome ou organização." },
        last_name: { label: "Sobrenome", help: "" },
        organization: { label: "Organização", help: "" },
        title: { label: "Cargo", help: "" },
        phone: { label: "Telefone", help: "De 3 a 15 dígitos, opcionalmente começando com +." },
        email: { label: "E-mail", help: "" },
        website: { label: "Site", help: "Começa com https:// ou http://." },
        address: { label: "Endereço", help: "" },
        note: { label: "Observação", help: "" },
      },
      email: {
        to: { label: "Destinatário", help: "" },
        subject: { label: "Assunto", help: "" },
        body: { label: "Mensagem", help: "" },
      },
      sms: {
        phone: { label: "Número de telefone", help: "De 3 a 15 dígitos, opcionalmente começando com +." },
        message: { label: "Mensagem", help: "" },
      },
      phone: {
        phone: { label: "Número de telefone", help: "De 3 a 15 dígitos, opcionalmente começando com +." },
      },
    },
    options: {
      WPA: "WPA/WPA2/WPA3",
      WEP: "WEP",
      nopass: "Nenhuma (rede aberta)",
    },
    sections: {
      content: "Conteúdo",
      design: "Design",
      download: "Baixar",
    },
    design: {
      fg: "Cor do código",
      bg: "Fundo",
      ecc: "Correção de erros",
      eccLevels: {
        L: "Baixa (7%)",
        M: "Média (15%)",
        Q: "Quartil (25%)",
        H: "Alta (30%)",
      },
      margin: "Margem (módulos)",
      lowContrast: "Use uma cor escura sobre um fundo claro com contraste de pelo menos 3:1, ou os leitores podem não ler o código.",
      logo: "Logo",
      logoHelp: "PNG ou JPEG, até 1 MB e 1024 × 1024 px.",
      logoUpload: "Enviar logo",
      colorPicker: "Escolher {name}",
      colorInvalid: "Digite uma cor como #1A2B3C.",
      logoRemove: "Remover logo",
      logoEcc: "Com logo, a correção de erros alta é usada para que o código continue legível.",
      logoType: "Escolha uma imagem PNG ou JPEG.",
      logoSize: "O logo deve ter no máximo 1 MB.",
    },
    preview: {
      title: "Pré-visualização",
      empty: "Preencha o conteúdo para ver seu QR Code.",
      updating: "Atualizando…",
      alt: "Pré-visualização do seu QR Code",
    },
    download: {
      format: "Formato",
      size: "Tamanho (px)",
      sizeHelp: "De {min} a {max} px.",
      button: "Baixar {format}",
      working: "Preparando…",
    },
    validation: {
      required: "Obrigatório.",
      invalid: "Verifique este valor.",
    },
    errors: {
      loadTypes: "Não foi possível carregar os tipos de QR Code.",
      retry: "Tentar novamente",
      rateLimited: "Muitas solicitações. Tente novamente em {seconds} segundos.",
      busy: "O servidor está ocupado. Tente novamente em instantes.",
      network: "Não foi possível conectar ao servidor. Verifique sua conexão.",
      tooLarge: "A solicitação é grande demais. Tente um logo menor.",
      generic: "Algo deu errado. Tente novamente.",
    },
  },
  dashboard: {
    welcome: "Olá, {name}",
  },
} satisfies Messages;
