import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale, type Locale } from "./config";
import { loadMessages, type Messages } from "./messages";

/** The locale of the current route (server components only). Unknown locales are a 404. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

/** Messages of the current route's locale (server components only). */
export async function getMessages(): Promise<Messages> {
  return loadMessages(await getLocale());
}
