/**
 * Hosted page content (backend PLAN items 23-27): the editor is built from the field schema of
 * `GET /v1/page-types`, so a field the API adds shows up without a release. The API stays the
 * authority on every rule; these checks only decide when a live preview is worth asking for.
 */

import type { CodePage, PageTheme } from "@/lib/api/types";
import { normalizeUrlInput } from "@/lib/qr/validate";

export type PageFieldKind =
  | "text"
  | "multiline"
  | "url"
  | "phone"
  | "email"
  | "date"
  | "datetime"
  | "time"
  | "weekday"
  | "timezone"
  | "social_network"
  | "video_url"
  | "list"
  | "upload"
  | "upload_pdf"
  | "upload_audio";

export interface PageField {
  name: string;
  kind: PageFieldKind | (string & {});
  required?: boolean;
  /** Characters, or items for a list. */
  max?: number;
  items?: PageField[];
}

export interface PageTypeInfo {
  name: string;
  fields: PageField[];
}

/** What the editor holds: strings, and lists of items that hold the same (a menu's dishes). */
export type DraftValue = string | DraftItem[];
export type DraftItem = { [name: string]: DraftValue };
export type PageDraft = Record<string, DraftValue>;

export type { PageTheme };

/** The page as the API takes it (`page` on POST .../codes and .../pages/preview). */
export interface PageBody {
  type: string;
  theme: PageTheme;
  content: Record<string, unknown>;
}

export const isUpload = (f: PageField) => f.kind === "upload" || f.kind === "upload_pdf" || f.kind === "upload_audio";

/** The fields this editor draws: all of them (a field of a kind it does not know shows as text). */
export const editableFields = (fields: PageField[]) => fields;

/** A choice field starts on a sensible value; everything else starts empty. */
export function defaultValue(field: PageField): string {
  if (field.kind === "weekday") return "mon";
  if (field.kind === "social_network") return "instagram";
  if (field.kind === "timezone") return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return "";
}

/** A field's starting value; a required list starts with one item to fill in. */
function startValue(field: PageField): DraftValue {
  if (field.kind !== "list") return defaultValue(field);
  return field.required ? [emptyItem(field.items ?? [])] : [];
}

const emptyItem = (items: PageField[]): DraftItem =>
  Object.fromEntries(editableFields(items).map((f) => [f.name, startValue(f)]));

/** A type's fields, empty. */
export function initialContent(type: PageTypeInfo): PageDraft {
  return emptyItem(type.fields);
}

export function newItem(field: PageField): DraftItem {
  return emptyItem(field.items ?? []);
}

/** The types this editor makes: all of them (lists inside lists included, item 27c). */
export function editableTypes(types: PageTypeInfo[]): PageTypeInfo[] {
  return types;
}

/** Choice fields hold a value from the start, so they alone never make an item worth sending. */
const isChoice = (f: PageField) => f.kind === "weekday" || f.kind === "social_network" || f.kind === "timezone";

function clean(field: PageField, raw: string): string {
  const value = raw.trim();
  if (value && (field.kind === "url" || field.kind === "video_url")) return normalizeUrlInput(value);
  return value;
}

/**
 * Where each sent list item sits in the editor, by the list's editor path: blank items are not
 * sent, so the API's `links[0]` may be the editor's `links[1]`, and `sections[0].items[0]` may be
 * the editor's `sections[1].items[2]` (keyed `sections` and `sections[1].items`).
 */
export type ItemPlaces = Record<string, number[]>;

export type BuiltContent =
  | { ok: true; content: Record<string, unknown>; places: ItemPlaces }
  | { ok: false; missing: string[] };

interface Built {
  content: Record<string, unknown>;
  /** Something worth sending besides preset choices (an item that has it is not blank). */
  filled: boolean;
}

/** Builds the fields of one level; `at` is the level's editor path prefix ("" or "sections[1]."). */
function buildLevel(fields: PageField[], draft: Partial<DraftItem>, at: string, missing: string[], places: ItemPlaces): Built {
  const content: Record<string, unknown> = {};
  let filled = false;
  for (const field of editableFields(fields)) {
    const value = draft[field.name];
    const path = `${at}${field.name}`;
    if (field.kind === "list") {
      const itemFields = field.items ?? [];
      const kept: { place: number; content: Record<string, unknown> }[] = [];
      (Array.isArray(value) ? value : []).forEach((item, place) => {
        // Missing fields of a blank item are not missing: the item is left out.
        const inner: string[] = [];
        const built = buildLevel(itemFields, item, `${path}[${place}].`, inner, places);
        if (!built.filled) return;
        missing.push(...inner);
        kept.push({ place, content: built.content });
      });
      if (kept.length > 0) {
        content[field.name] = kept.map((k) => k.content);
        places[path] = kept.map((k) => k.place);
        filled = true;
      } else if (field.required) missing.push(path);
      continue;
    }
    const text = clean(field, typeof value === "string" ? value : "");
    if (text !== "") {
      content[field.name] = text;
      if (!isChoice(field)) filled = true;
    } else if (field.required) missing.push(path);
  }
  return { content, filled };
}

/**
 * The content to send: trimmed, without empty optional fields or list items left blank (at any
 * depth). Missing required fields are named by their editor path (`links[0].url`).
 */
export function buildContent(type: PageTypeInfo, draft: Partial<PageDraft>): BuiltContent {
  const missing: string[] = [];
  const places: ItemPlaces = {};
  const { content } = buildLevel(type.fields, draft, "", missing, places);
  return missing.length > 0 ? { ok: false, missing } : { ok: true, content, places };
}

/** An API path of sent content (`sections[0].items[0].name`) as the editor's path, level by level. */
export function editorPath(path: string, places: ItemPlaces | undefined): string {
  let out = "";
  let rest = path;
  for (;;) {
    const m = /^([a-z_]+)\[(\d+)\](\.?)(.*)$/.exec(rest);
    if (!m) return out + rest;
    const list = `${out}${m[1]}`;
    const place = places?.[list]?.[Number(m[2])] ?? Number(m[2]);
    out = `${list}[${place}]${m[3]}`;
    rest = m[4];
  }
}

/** The editor's path of a field the API refused (`page.content.links[0].url` → `links[0].url`). */
export function contentPath(apiField: string | undefined): string | undefined {
  const prefix = "page.content.";
  return apiField?.startsWith(prefix) ? apiField.slice(prefix.length) : undefined;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** One level of saved content as editor values; a value of the wrong shape is taken as unset. */
function draftLevel(fields: PageField[], saved: unknown): DraftItem {
  const values = isRecord(saved) ? saved : {};
  const out: DraftItem = {};
  for (const field of editableFields(fields)) {
    const value = values[field.name];
    if (field.kind === "list") {
      const items = Array.isArray(value) ? value.filter(isRecord).map((item) => draftLevel(field.items ?? [], item)) : [];
      out[field.name] = items.length > 0 ? items : startValue(field);
      continue;
    }
    out[field.name] = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : defaultValue(field);
  }
  return out;
}

/** A saved page's content as the editor holds it (editing a page code, item 27c). */
export function draftFromContent(type: PageTypeInfo, saved: unknown): PageDraft {
  return draftLevel(type.fields, saved);
}

/** JSON with object keys sorted, so two contents compare by value. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}

/** Whether two page contents (or themes) hold the same values, whatever their key order. */
export function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** A page as PATCH .../codes/{id} takes it: the content and colors, and the saved frame. */
export interface PageToSend extends PageBody {
  cover_upload_id?: string;
  welcome_upload_id?: string;
  share?: boolean;
  button?: { label: string; url: string };
  socials?: { network: string; username: string }[];
}

/**
 * A saved page with new colors and content, as the API takes it. The frame goes back as saved
 * but only in the fields the API accepts (it refuses unknown ones): a social channel is sent
 * by network and username, without the link GET adds to it.
 */
export function pageToSend(saved: CodePage, theme: PageTheme, content: Record<string, unknown>): PageToSend {
  return {
    type: saved.type,
    theme,
    ...(saved.cover_upload_id ? { cover_upload_id: saved.cover_upload_id } : {}),
    ...(saved.welcome_upload_id ? { welcome_upload_id: saved.welcome_upload_id } : {}),
    ...(saved.share ? { share: true } : {}),
    ...(saved.button ? { button: { label: saved.button.label, url: saved.button.url } } : {}),
    ...(saved.socials?.length ? { socials: saved.socials.map((s) => ({ network: s.network, username: s.username ?? "" })) } : {}),
    content,
  };
}
