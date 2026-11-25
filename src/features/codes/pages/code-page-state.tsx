import { FormAlert, TextLink } from "@/components/form/form-bits";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { CodeLoad } from "../use-code";

/** What a page of a code shows until the code is there: "loading", or why it is not. Null once ready. */
export function CodePageState({ t, locale, load, loading }: { t: Messages["codes"]; locale: Locale; load: CodeLoad; loading: string }) {
  if (load.kind === "ready") return null;
  return (
    <div className="flex flex-col items-start gap-4">
      <TextLink href={localizePath(locale, "/app")}>← {t.back}</TextLink>
      {load.kind === "loading" ? (
        <p role="status" className="text-sm text-muted">
          {loading}
        </p>
      ) : (
        <FormAlert message={load.kind === "missing" ? t.notFound : t.loadFailed} />
      )}
    </div>
  );
}
