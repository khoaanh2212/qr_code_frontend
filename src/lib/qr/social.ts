/**
 * Social profile presets (backend PLAN item 58): a network and a username instead of a URL.
 * Client-side copy of the API's rules (internal/model/social.go), so the forms can say what is
 * wrong before calling it, and read a stored link back into its parts. The API stays the authority.
 */

export const SOCIAL_NETWORKS = ["instagram", "facebook", "tiktok", "youtube", "whatsapp"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface SocialLink {
  network: SocialNetwork;
  /** The handle (a leading @ is dropped) or, for WhatsApp, the number with its country code. */
  username: string;
  /** WhatsApp only: the message the chat opens with; blank means none. */
  text: string;
}

/** A WhatsApp opening message, in characters (runes). */
export const SOCIAL_TEXT_MAX = 500;
/** The API's limit on a code's destination (MaxTargetURLBytes). */
const TARGET_URL_MAX_BYTES = 2048;

interface Rule {
  pattern: RegExp;
  link: (user: string) => string;
  /** The link's shape, capturing the username (the inverse of `link`). */
  shape: RegExp;
}

const RULES: Record<SocialNetwork, Rule> = {
  instagram: {
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    link: (u) => `https://www.instagram.com/${u}/`,
    shape: /^https:\/\/www\.instagram\.com\/([^/?#]+)\/$/,
  },
  facebook: {
    pattern: /^[A-Za-z0-9.]{5,50}$/,
    link: (u) => `https://www.facebook.com/${u}`,
    shape: /^https:\/\/www\.facebook\.com\/([^/?#]+)$/,
  },
  tiktok: {
    pattern: /^[A-Za-z0-9._]{2,24}$/,
    link: (u) => `https://www.tiktok.com/@${u}`,
    shape: /^https:\/\/www\.tiktok\.com\/@([^/?#]+)$/,
  },
  youtube: {
    pattern: /^[A-Za-z0-9._-]{3,30}$/,
    link: (u) => `https://www.youtube.com/@${u}`,
    shape: /^https:\/\/www\.youtube\.com\/@([^/?#]+)$/,
  },
  whatsapp: {
    pattern: /^[0-9]{7,15}$/,
    link: (u) => `https://wa.me/${u}`,
    shape: /^https:\/\/wa\.me\/([^/?#]+)$/,
  },
};

export function isSocialNetwork(v: unknown): v is SocialNetwork {
  return SOCIAL_NETWORKS.includes(v as SocialNetwork);
}

/** The username as the API reads it: trimmed, without a leading @, without a number's separators. */
export function normalizeUsername(network: SocialNetwork, username: string): string {
  const user = username.trim().replace(/^@/, "");
  return network === "whatsapp" ? user.replace(/[ \-().+]/g, "") : user;
}

/** Go's url.QueryEscape, then %20 for spaces (as the API writes the message). */
function queryEscape(text: string): string {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Why a link would be refused, or null. */
export type SocialProblem = "usernameRequired" | "username" | "textNotAllowed" | "text" | "textLong";

// Control characters other than line breaks and tabs, and bidi controls (they make a message read
// differently from what it says); zero-width joiners stay, emoji need them.
const BAD_TEXT = /[\p{Cc}\p{Bidi_Control}]/u;
/** No unpaired surrogate (String.prototype.isWellFormed, without needing ES2024 types). */
const WELL_FORMED = /^(?:[^\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/;

export function socialProblem(link: SocialLink): SocialProblem | null {
  const user = normalizeUsername(link.network, link.username);
  if (user === "") return "usernameRequired";
  // Every alphabet leaves out URL-reserved characters; a handle needs a letter or digit, since
  // "." or ".." would be a path step to the network's home page.
  if (!RULES[link.network].pattern.test(user) || !/[A-Za-z0-9]/.test(user)) return "username";
  const text = link.text.trim();
  if (text === "") return null;
  if (link.network !== "whatsapp") return "textNotAllowed";
  // A lone surrogate (half an emoji, cut by a length limit) is not valid text and cannot be escaped.
  if (!WELL_FORMED.test(text) || [...text].length > SOCIAL_TEXT_MAX || BAD_TEXT.test(text.replace(/[\n\r\t]/g, ""))) return "text";
  if (socialUrl(link).length > TARGET_URL_MAX_BYTES) return "textLong";
  return null;
}

/** The link the API builds (the username's alphabet needs no escaping). */
export function socialUrl(link: SocialLink): string {
  const base = RULES[link.network].link(normalizeUsername(link.network, link.username));
  const text = link.text.trim();
  return link.network === "whatsapp" && text !== "" ? `${base}?text=${queryEscape(text)}` : base;
}

/**
 * The preset a stored destination was built from, or null when it is not exactly the shape the
 * API builds (any other link stays a website address).
 */
export function parseSocialUrl(url: string): SocialLink | null {
  let path = url;
  let text = "";
  if (url.startsWith("https://wa.me/")) {
    const m = /^([^?#]*)(?:\?text=([^&#]*))?$/.exec(url);
    if (!m) return null;
    path = m[1];
    try {
      text = m[2] === undefined ? "" : decodeURIComponent(m[2]);
    } catch {
      return null;
    }
  }
  for (const network of SOCIAL_NETWORKS) {
    const m = RULES[network].shape.exec(path);
    if (!m) continue;
    const link: SocialLink = { network, username: m[1], text };
    // Only a link the API would build from these parts counts (this also refuses "..").
    return socialProblem(link) === null && socialUrl(link) === url ? link : null;
  }
  return null;
}
