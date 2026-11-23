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
  generator: {
    loading: "Loading…",
    typesLabel: "QR code type",
    types: {
      url: "Website",
      text: "Text",
      wifi: "Wi-Fi",
      vcard: "Contact",
      email: "Email",
      sms: "SMS",
      phone: "Phone",
    },
    fields: {
      url: {
        url: { label: "Website address", help: "Starts with https:// or http://." },
      },
      text: {
        text: { label: "Text", help: "" },
      },
      wifi: {
        ssid: { label: "Network name (SSID)", help: "Up to 32 bytes." },
        password: { label: "Password", help: "WPA: 8 to 63 characters. For an open network, set Security to None." },
        encryption: { label: "Security", help: "" },
        hidden: { label: "Hidden network", help: "" },
      },
      vcard: {
        first_name: { label: "First name", help: "Enter a first name, last name or organization." },
        last_name: { label: "Last name", help: "" },
        organization: { label: "Organization", help: "" },
        title: { label: "Job title", help: "" },
        phone: { label: "Phone", help: "3 to 15 digits, optionally starting with +." },
        email: { label: "Email", help: "" },
        website: { label: "Website", help: "Starts with https:// or http://." },
        address: { label: "Address", help: "" },
        note: { label: "Note", help: "" },
      },
      email: {
        to: { label: "Recipient", help: "" },
        subject: { label: "Subject", help: "" },
        body: { label: "Message", help: "" },
      },
      sms: {
        phone: { label: "Phone number", help: "3 to 15 digits, optionally starting with +." },
        message: { label: "Message", help: "" },
      },
      phone: {
        phone: { label: "Phone number", help: "3 to 15 digits, optionally starting with +." },
      },
    },
    options: {
      WPA: "WPA/WPA2/WPA3",
      WEP: "WEP",
      nopass: "None (open network)",
    },
    sections: {
      content: "Content",
      design: "Design",
      download: "Download",
    },
    design: {
      fg: "Foreground",
      bg: "Background",
      ecc: "Error correction",
      eccLevels: {
        L: "Low (7%)",
        M: "Medium (15%)",
        Q: "Quartile (25%)",
        H: "High (30%)",
      },
      margin: "Margin (modules)",
      lowContrast: "Use a dark color on a light background with a contrast of at least 3:1, or scanners may not read the code.",
      logo: "Logo",
      logoHelp: "PNG or JPEG, up to 1 MB and 1024 × 1024 px.",
      logoUpload: "Upload logo",
      colorPicker: "Pick {name}",
      colorInvalid: "Enter a color like #1A2B3C.",
      logoRemove: "Remove logo",
      logoEcc: "A logo uses high error correction so the code still scans.",
      logoType: "Choose a PNG or JPEG image.",
      logoSize: "The logo must be 1 MB or smaller.",
    },
    preview: {
      title: "Preview",
      empty: "Fill in the content to see your QR code.",
      updating: "Updating…",
      alt: "Preview of your QR code",
      fixField: "Fix “{field}” to see your QR code.",
      jump: "Preview & download",
    },
    download: {
      format: "Format",
      size: "Size (px)",
      sizeHelp: "From {min} to {max} px.",
      button: "Download {format}",
      working: "Preparing…",
      saved: "Saved {file}",
    },
    validation: {
      required: "Required.",
      invalid: "Check this value.",
      url: "Start with https:// or http://, like https://example.com.",
      email: "Enter an email address like name@example.com.",
      phone: "Use 3 to 15 digits, optionally starting with +.",
      ssidBytes: "The network name is too long (32 bytes at most; accented letters count double).",
      wpa: "A WPA password has 8 to 63 characters (or is a 64-digit hex key).",
      vcardName: "Enter a first name, last name or organization.",
    },
    errors: {
      loadTypes: "Could not load the QR code types.",
      retry: "Try again",
      rateLimited: "Too many requests. Try again in {seconds} seconds.",
      busy: "The server is busy. Try again in a moment.",
      network: "Cannot reach the server. Check your connection.",
      tooLarge: "The request is too large. Try a smaller logo.",
      generic: "Something went wrong. Try again.",
    },
  },
  dashboard: {
    welcome: "Welcome, {name}",
  },
};

export type Messages = typeof en;
