import { isPresetCaption, styleParams, type QrData, type QrDesign, type QrFormat, type QrType } from "./types";

/** Types whose content is a secret or personal data: never put in a URL. */
const SENSITIVE_TYPES = new Set(["wifi", "vcard"]);

/** vCard needs at least one of these (the API's rule; checked here to avoid a useless call). */
const VCARD_NAME_FIELDS = ["first_name", "last_name", "organization"];

export interface RenderInput {
  type: string;
  data: QrData;
  design: QrDesign;
  format: QrFormat;
  size: number;
}

export interface RenderPostBody {
  type: string;
  data: QrData;
  format: QrFormat;
  size: number;
  margin: number;
  ecc: string;
  style: { fg: string; bg: string; logo_base64?: string } & ReturnType<typeof styleParams>;
}

/** The signed-in render: the only one that takes a caption of the user's own. */
export const SIGNED_IN_RENDER = "/v1/me/qr/render";

export type RenderRequest =
  | { method: "GET"; path: string }
  | { method: "POST"; path: "/v1/qr/render" | typeof SIGNED_IN_RENDER; body: RenderPostBody };

/** A frame caption that is not a preset: it needs the signed-in render. */
export function hasCustomCaption(design: QrDesign): boolean {
  return design.frame !== "none" && !isPresetCaption(design.frameText);
}

/** An open Wi-Fi network: it has no password. */
export function isOpenWifi(type: string, data: QrData): boolean {
  return type === "wifi" && data.encryption === "nopass";
}

function filled(type: string, data: QrData): QrData {
  const out: QrData = {};
  for (const [k, v] of Object.entries(data)) if (v.trim() !== "") out[k] = v;
  if (isOpenWifi(type, data)) delete out.password;
  return out;
}

/**
 * The API call that renders `input`. GET (cacheable at the CDN) for plain content without a
 * logo; POST for Wi-Fi and vCard content (kept out of URLs, logs and history), for a logo, and
 * whenever `post` is set (downloads). A logo forces error correction H, as the API does.
 */
export function buildRenderRequest(input: RenderInput, { post = false } = {}): RenderRequest {
  const data = filled(input.type, input.data);
  const { design } = input;
  // A logo or an icon hides modules: the API forces level H for both.
  const ecc = design.logo || design.logoIcon ? "H" : design.ecc;

  const custom = hasCustomCaption(design);
  if (!post && !design.logo && !custom && !SENSITIVE_TYPES.has(input.type)) {
    const q = new URLSearchParams({
      type: input.type,
      format: input.format,
      size: String(input.size),
      margin: String(design.margin),
      ecc,
      fg: design.fg.replace(/^#/, ""),
      bg: design.bg.replace(/^#/, ""),
      ...styleParams(design),
    });
    for (const [k, v] of Object.entries(data)) q.append(k, v);
    return { method: "GET", path: `/v1/qr/render?${q.toString()}` };
  }

  const style: RenderPostBody["style"] = { fg: design.fg, bg: design.bg, ...styleParams(design) };
  if (design.logo) style.logo_base64 = design.logo.base64;
  return {
    method: "POST",
    path: custom ? SIGNED_IN_RENDER : "/v1/qr/render",
    body: { type: input.type, data, format: input.format, size: input.size, margin: design.margin, ecc, style },
  };
}

/**
 * Required fields still empty; for vCard, the first name field when no name is given; for a
 * secured Wi-Fi network, the password.
 */
export function missingRequired(type: QrType, data: QrData): string[] {
  const has = (name: string) => (data[name] ?? "").trim() !== "";
  const missing = type.fields.filter((f) => f.required && !has(f.name)).map((f) => f.name);
  if (type.type === "vcard" && !VCARD_NAME_FIELDS.some(has)) missing.push(VCARD_NAME_FIELDS[0]);
  // A secured network needs its password (the API rejects WPA/WEP without one).
  if (type.type === "wifi" && !isOpenWifi(type.type, data) && !has("password")) missing.push("password");
  return missing;
}

/** A cheap identity of a request: the logo is represented by its id, not its bytes. */
export function requestKey(request: RenderRequest, logoId?: string): string {
  if (request.method === "GET") return request.path;
  const style = { ...request.body.style };
  delete style.logo_base64;
  return JSON.stringify({ ...request.body, style, logo: logoId ?? null });
}
