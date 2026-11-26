/**
 * Where a dynamic code leads: a website address, or a social profile preset (backend PLAN item
 * 58) that the API turns into the profile's link. The API answers only the built `target_url`,
 * so the edit page recognizes a preset from the link's shape.
 */

import type { Messages } from "@/i18n/messages";
import { normalizeUsername, parseSocialUrl, socialProblem, socialUrl, type SocialLink } from "@/lib/qr/social";
import { normalizeUrlInput } from "@/lib/qr/validate";

export type DestinationKind = "url" | "social";

/** Both kinds keep their input, so switching back and forth loses nothing. */
export interface DestinationState {
  kind: DestinationKind;
  url: string;
  link: SocialLink;
}

/** A social preset as the API takes it (`social` on POST and PATCH .../codes). */
export interface SocialBody {
  network: SocialLink["network"];
  username: string;
  text?: string;
}

export type DestinationBody = { target_url: string } | { social: SocialBody };

export type DestinationField = "target_url" | "social.username" | "social.text";

export function isDestinationField(field: string | undefined): field is DestinationField {
  return field === "target_url" || field === "social.username" || field === "social.text";
}

type Checked<T> = ({ ok: true } & T) | { ok: false; field: DestinationField; message: string };

const EMPTY_LINK: SocialLink = { network: "instagram", username: "", text: "" };

/** A stored destination: its preset when the link is exactly one the API builds, else an address. */
export function initialDestination(targetUrl: string): DestinationState {
  const link = parseSocialUrl(targetUrl);
  return link ? { kind: "social", url: targetUrl, link } : { kind: "url", url: targetUrl, link: EMPTY_LINK };
}

/** The preset as the API reads it; a message left from WhatsApp is dropped for other networks. */
function socialBody(link: SocialLink): SocialBody {
  const text = link.network === "whatsapp" ? link.text.trim() : "";
  return { network: link.network, username: normalizeUsername(link.network, link.username), ...(text ? { text } : {}) };
}

/**
 * The destination to send and the link it leads to, or the field that is wrong. Checks the same
 * rules as the API first; the API stays the authority.
 */
export function destinationFor(d: DestinationState, t: Messages["codes"]): Checked<{ body: DestinationBody; url: string }> {
  if (d.kind === "url") {
    const url = normalizeUrlInput(d.url);
    if (!/^https?:\/\//i.test(url)) return { ok: false, field: "target_url", message: t.errors.targetUrl };
    return { ok: true, body: { target_url: url }, url };
  }
  const body = socialBody(d.link);
  const link = { ...body, text: body.text ?? "" };
  const problem = socialProblem(link);
  if (problem === "text" || problem === "textLong") return { ok: false, field: "social.text", message: t.errors.socialText };
  if (problem !== null) return { ok: false, field: "social.username", message: t.errors.socialUsername };
  return { ok: true, body: { social: body }, url: socialUrl(link) };
}

/** What an edit sends about the destination: nothing while it still leads where it did. */
export function destinationChanges(d: DestinationState, stored: string, t: Messages["codes"]): Checked<{ changes: Partial<DestinationBody> }> {
  const checked = destinationFor(d, t);
  if (!checked.ok) return checked;
  return { ok: true, changes: checked.url === stored ? {} : checked.body };
}
