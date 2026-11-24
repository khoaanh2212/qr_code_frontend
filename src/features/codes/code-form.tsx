"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Captcha, type CaptchaConfig } from "@/features/auth/captcha";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin, usePersonalWorkspace } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { normalizeUrlInput } from "@/lib/qr/validate";
import { createCode } from "./api";
import { DEFAULT_LOOK, designFromLook, lookScannable, type CodeLook } from "./design";
import { codeFailure, type CodeField } from "./errors";
import { clearHandoff, readHandoff } from "./handoff";
import { LookFields } from "./look-fields";

export const NAME_MAX = 100;

/** "New dynamic code": name, destination and colors; opens the new code once created. */
export function CodeForm({
  t,
  generator,
  templates,
  auth,
  locale,
  captcha,
}: {
  t: Messages["codes"];
  generator: Messages["generator"];
  templates: Messages["templates"];
  auth: AuthMessages;
  locale: Locale;
  captcha: CaptchaConfig;
}) {
  const router = useRouter();
  const workspace = usePersonalWorkspace();
  // The public generator's "Make it dynamic" hands over its destination and look. The form
  // renders only on the client (after the session check), so reading storage here is safe.
  const [handoff] = useState(readHandoff);
  useEffect(clearHandoff, []);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(handoff?.url ?? "");
  const [look, setLook] = useState<CodeLook>(() => ({
    ...DEFAULT_LOOK,
    ...handoff?.style,
    fg: handoff?.fg ?? DEFAULT_LOOK.fg,
    bg: handoff?.bg ?? DEFAULT_LOOK.bg,
  }));
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const contrastOk = lookScannable(look);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!workspace || busy) return;
    const url = normalizeUrlInput(target);
    if (url !== target) setTarget(url);
    if (!/^https?:\/\//i.test(url)) {
      setError({ field: "target_url", message: t.errors.targetUrl });
      targetRef.current?.focus();
      return;
    }
    if (!contrastOk) {
      setError({ field: "colors", message: t.errors.colors });
      return;
    }
    if (!token) {
      setError({ message: auth.errors.captchaRequired });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const code = await createCode(workspace.id, {
        name: name.trim(),
        target_url: url,
        design: designFromLook(look),
        captcha_token: token,
      });
      router.push(localizePath(locale, `/app/codes/${code.id}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = codeFailure(err, t, auth);
      setError(failure);
      if (failure.field === "target_url") targetRef.current?.focus();
      setReset((n) => n + 1);
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <TextLink href={localizePath(locale, "/app")}>← {t.back}</TextLink>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t.newTitle}</h1>
        <p className="text-sm text-pretty text-muted">{t.newIntro}</p>
      </header>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          ref={targetRef}
          label={t.target}
          help={t.targetHelp}
          required
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          maxLength={2048}
          value={target}
          error={error?.field === "target_url" ? error.message : undefined}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() => setTarget((v) => normalizeUrlInput(v))}
        />
        <TextField
          label={t.name}
          help={t.nameHelp}
          maxLength={NAME_MAX}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <LookFields
          t={t}
          generator={generator}
          look={look}
          onChange={(update) => {
            setLook(update);
            if (error?.field === "colors" || error?.field === "frame_text") setError(null);
          }}
          error={error}
          templates={workspace ? { t: templates, workspaceId: workspace.id } : undefined}
        />
        <Captcha
          config={captcha}
          locale={locale}
          labels={{ label: auth.captchaLabel, loadFailed: auth.captchaLoadFailed, retry: auth.retry }}
          resetSignal={reset}
          onToken={setToken}
        />
        <FormAlert message={error && !error.field ? error.message : undefined} />
        <Button type="submit" busy={busy} className="w-fit">
          {t.create}
        </Button>
      </form>
    </div>
  );
}
