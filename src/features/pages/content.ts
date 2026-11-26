/**
 * Hosted page content (backend PLAN items 23-27): the editor is built from the field schema of
 * `GET /v1/page-types`, so a field the API adds shows up without a release. The API stays the
 * authority on every rule; these checks only decide when a live preview is worth asking for.
 */

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

/** What the editor holds: strings, and lists of items of strings. */
export type DraftValue = string | DraftItem[];
export type DraftItem = Record<string, string>;
export type PageDraft = Record<string, DraftValue>;

/** The page as the API takes it (`page` on POST .../codes and .../pages/preview). */
export interface PageBody {
  type: string;
  theme: { primary: string; button: string };
  content: Record<string, unknown>;
}

const isUpload = (f: PageField) => f.kind === "upload" || f.kind === "upload_pdf" || f.kind === "upload_audio";

/** The fields this editor draws (uploads come with the upload step of the editor). */
export const editableFields = (fields: PageField[]) => fields.filter((f) => !isUpload(f));

/** A choice field starts on a sensible value; everything else starts empty. */
export function defaultValue(field: PageField): string {
  if (field.kind === "weekday") return "mon";
  if (field.kind === "social_network") return "instagram";
  if (field.kind === "timezone") return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return "";
}

const emptyItem = (items: PageField[]): DraftItem =>
  Object.fromEntries(editableFields(items).map((f) => [f.name, defaultValue(f)]));

/** A type's fields, empty; a required list starts with one item to fill in. */
export function initialContent(type: PageTypeInfo): PageDraft {
  return Object.fromEntries(
    editableFields(type.fields).map((f) => [
      f.name,
      f.kind === "list" ? (f.required ? [emptyItem(f.items ?? [])] : []) : defaultValue(f),
    ]),
  );
}

export function newItem(field: PageField): DraftItem {
  return emptyItem(field.items ?? []);
}

/**
 * A type can be made here when none of its required fields (or required list items) is an
 * upload, and none of its lists holds another list (the menu's sections of dishes): uploads and
 * nested lists come with item 27c.
 */
export function editableTypes(types: PageTypeInfo[]): PageTypeInfo[] {
  const needsUpload = (fields: PageField[]): boolean =>
    fields.some((f) => f.required && (isUpload(f) || (f.kind === "list" && needsUpload(f.items ?? []))));
  const nestsLists = (fields: PageField[]) =>
    fields.some((f) => f.kind === "list" && (f.items ?? []).some((i) => i.kind === "list"));
  return types.filter((t) => !needsUpload(t.fields) && !nestsLists(t.fields));
}

/** Choice fields hold a value from the start, so they alone never make an item worth sending. */
const isChoice = (f: PageField) => f.kind === "weekday" || f.kind === "social_network" || f.kind === "timezone";

function clean(field: PageField, raw: string): string {
  const value = raw.trim();
  if (value && (field.kind === "url" || field.kind === "video_url")) return normalizeUrlInput(value);
  return value;
}

/**
 * Where each sent list item sits in the editor, by list: blank items are not sent, so the API's
 * `links[0]` may be the editor's `links[1]`.
 */
export type ItemPlaces = Record<string, number[]>;

export type BuiltContent =
  | { ok: true; content: Record<string, unknown>; places: ItemPlaces }
  | { ok: false; missing: string[] };

/**
 * The content to send: trimmed, without empty optional fields or list items left blank. Missing
 * required fields are named by the path the API uses in its refusals (`links[0].url`).
 */
export function buildContent(type: PageTypeInfo, draft: Partial<PageDraft>): BuiltContent {
  const content: Record<string, unknown> = {};
  const missing: string[] = [];
  const places: ItemPlaces = {};
  for (const field of editableFields(type.fields)) {
    const value = draft[field.name];
    if (field.kind === "list") {
      const itemFields = editableFields(field.items ?? []);
      const kept = (Array.isArray(value) ? value : [])
        .map((item, place) => ({ place, item: Object.fromEntries(itemFields.map((f) => [f.name, clean(f, item[f.name] ?? "")])) }))
        .filter(({ item }) => itemFields.some((f) => !isChoice(f) && item[f.name] !== ""));
      for (const { place, item } of kept) {
        for (const f of itemFields) if (f.required && item[f.name] === "") missing.push(`${field.name}[${place}].${f.name}`);
        for (const key of Object.keys(item)) if (item[key] === "") delete item[key];
      }
      if (kept.length > 0) {
        content[field.name] = kept.map(({ item }) => item);
        places[field.name] = kept.map(({ place }) => place);
      } else if (field.required) missing.push(field.name);
      continue;
    }
    const text = clean(field, typeof value === "string" ? value : "");
    if (text !== "") content[field.name] = text;
    else if (field.required) missing.push(field.name);
  }
  return missing.length > 0 ? { ok: false, missing } : { ok: true, content, places };
}

/** An API path of sent content (`links[0].url`) as the editor's path (`links[1].url`). */
export function editorPath(path: string, places: ItemPlaces | undefined): string {
  const m = /^([a-z_]+)\[(\d+)\](.*)$/.exec(path);
  const place = m && places?.[m[1]]?.[Number(m[2])];
  return m && place !== undefined ? `${m[1]}[${place}]${m[3]}` : path;
}

/** The editor's path of a field the API refused (`page.content.links[0].url` → `links[0].url`). */
export function contentPath(apiField: string | undefined): string | undefined {
  const prefix = "page.content.";
  return apiField?.startsWith(prefix) ? apiField.slice(prefix.length) : undefined;
}
