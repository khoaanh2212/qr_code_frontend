"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Captcha, type CaptchaConfig } from "@/features/auth/captcha";
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
import { PREVIEW_ID, PreviewPane, useLookPreview } from "./design-preview";

export const NAME_MAX = 100;

type T = Messages["codes"];
type Step = "destination" | "design";

/**
 * What the preview encodes: the code's own short link only exists once it is created, so a link
 * of the same shape stands in for it. The design is what the preview is for.
 */
const SAMPLE_LINK = "https://example.com/AbCd1234";
/** How long after a step change a click on a creating button is taken for a double click. */
const STEP_GUARD_MS = 500;

/**
 * "New dynamic code" in two steps: the destination (and a name), then the design beside a live
 * preview. The code is created by the last button only ("Create dynamic code", or "Create with
 * the default design" on the first step), so leaving earlier leaves nothing behind. Afterwards
 * the list greets the new code with its download dialog (`?ready=`). The actions sit in a bar
 * fixed to the bottom edge at every width; on narrow screens it also carries a thumbnail of the
 * preview that jumps to it.
 */
export function CodeForm({
  t,
  generator,
  templates,
  auth,
  locale,
  captcha,
}: {
  t: T;
  generator: Messages["generator"];
  templates: Messages["templates"];
  auth: AuthMessages;
  locale: Locale;
  captcha: CaptchaConfig;
}) {
  const w = t.wizard;
  const router = useRouter();
  const workspace = usePersonalWorkspace();
  // The public generator's "Make it dynamic" hands over its destination and look. The form
  // renders only on the client (after the session check), so reading storage here is safe.
  const [handoff] = useState(readHandoff);
  useEffect(clearHandoff, []);
  const [step, setStep] = useState<Step>("destination");
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef(false);
  const moved = useRef(false);
  // When the step last changed: the bar's buttons swap in place, so the second click of a double
  // click on "Next" would land on "Create" (and one on "Back" on "Create with the default design").
  const steppedAt = useRef(0);
  const formId = useId();

  const contrastOk = lookScannable(look);

  // A new step starts at its heading; a refused address goes back to its field.
  useEffect(() => {
    if (focusTarget.current) {
      focusTarget.current = false;
      targetRef.current?.focus();
    } else if (moved.current) {
      headingRef.current?.focus();
    }
    moved.current = false;
  }, [step]);

  function go(next: Step) {
    moved.current = true;
    steppedAt.current = Date.now();
    setStep(next);
  }

  /** The address as the API takes it, or null after saying what is wrong with it. */
  function checkedTarget(): string | null {
    const url = normalizeUrlInput(target);
    if (url !== target) setTarget(url);
    if (/^https?:\/\//i.test(url)) return url;
    setError({ field: "target_url", message: t.errors.targetUrl });
    if (step === "destination") targetRef.current?.focus();
    else {
      focusTarget.current = true;
      go("destination");
    }
    return null;
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (busy || checkedTarget() === null) return;
    setError(null);
    go("design");
  }

  async function create(withLook: CodeLook) {
    if (!workspace || busy) return;
    if (Date.now() - steppedAt.current < STEP_GUARD_MS) return; // the tail of a double click
    const url = checkedTarget();
    if (url === null) return;
    if (!lookScannable(withLook)) return setError({ field: "colors", message: t.errors.colors });
    if (!token) return setError({ message: auth.errors.captchaRequired });
    setBusy(true);
    setError(null);
    try {
      const code = await createCode(workspace.id, {
        name: name.trim(),
        target_url: url,
        design: designFromLook(withLook),
        captcha_token: token,
      });
      router.push(`${localizePath(locale, "/app")}?ready=${encodeURIComponent(code.id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = codeFailure(err, t, auth);
      setError(failure);
      // The address and the name live on the first step: show the refusal where it can be fixed.
      if ((failure.field === "target_url" || failure.field === "name") && step !== "destination") {
        focusTarget.current = failure.field === "target_url";
        go("destination");
      } else if (failure.field === "target_url") targetRef.current?.focus();
      setReset((n) => n + 1);
      setBusy(false);
    }
  }

  const { preview } = useLookPreview(look, SAMPLE_LINK, step === "design");

  // A refusal about a field the current step does not show (the default design, say, from the
  // first step) is said in the alert, so it is never silent.
  const fieldsHere: CodeField[] = step === "destination" ? ["target_url", "name"] : ["colors", "frame_text"];
  const alert = error && (!error.field || !fieldsHere.includes(error.field)) ? error.message : undefined;

  const steps: { id: Step; label: string }[] = [
    { id: "destination", label: w.stepDestination },
    { id: "design", label: w.stepDesign },
  ];

  return (
    // Room below for the action bar, which is fixed to the bottom edge.
    <div className="flex flex-col gap-6 pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <TextLink href={localizePath(locale, "/app")}>← {t.back}</TextLink>
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t.newTitle}</h1>
          <p className="max-w-prose text-sm text-pretty text-muted">{t.newIntro}</p>
        </div>
        <ol aria-label={w.steps} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {steps.map((s, i) => (
            <li
              key={s.id}
              aria-current={s.id === step ? "step" : undefined}
              className={`inline-flex items-center gap-2 ${s.id === step ? "font-semibold" : "text-muted"}`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex size-6 items-center justify-center rounded-full border text-xs tabular-nums ${
                  s.id === step ? "border-accent bg-accent text-accent-foreground" : "border-control"
                }`}
              >
                {i + 1}
              </span>
              {s.label}
              {i < steps.length - 1 && <span aria-hidden="true" className="ml-1 h-px w-6 bg-border sm:w-10" />}
            </li>
          ))}
        </ol>
      </header>

      {step === "destination" ? (
        <form id={formId} noValidate onSubmit={next} className="flex max-w-xl flex-col gap-5">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
            {w.destinationTitle}
          </h2>
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
            onChange={(e) => {
              setTarget(e.target.value);
              if (error?.field === "target_url") setError(null);
            }}
            onBlur={() => setTarget((v) => normalizeUrlInput(v))}
          />
          <TextField
            label={t.name}
            help={t.nameHelp}
            maxLength={NAME_MAX}
            autoComplete="off"
            value={name}
            error={error?.field === "name" ? error.message : undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
          {/* First in the document, so it is first on narrow screens for everyone; beside the options from `lg`. */}
          <PreviewPane
            t={t}
            preview={preview}
            blocked={!contrastOk}
            transparent={look.transparent}
            note={w.previewNote}
            resetLabel={w.resetDesign}
            onReset={() => setLook(DEFAULT_LOOK)}
          />
          <form
            id={formId}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void create(look);
            }}
            onKeyDown={(e) => {
              // Enter in a text field (a color, the frame's caption) must not create the code.
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
            }}
            className="flex min-w-0 flex-col gap-5 lg:max-w-xl"
          >
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
              {w.stepDesign}
            </h2>
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
          </form>
        </div>
      )}

      <div className="max-w-xl">
        <Captcha
          config={captcha}
          locale={locale}
          labels={{ label: auth.captchaLabel, loadFailed: auth.captchaLoadFailed, retry: auth.retry }}
          resetSignal={reset}
          onToken={setToken}
        />
      </div>
      <FormAlert message={alert} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          {step === "design" && preview.src && (
            <button
              type="button"
              aria-label={w.showPreview}
              title={w.showPreview}
              onClick={() => document.getElementById(PREVIEW_ID)?.scrollIntoView?.({ block: "start" })}
              className="mr-auto flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-control bg-white p-0.5 lg:hidden"
            >
              {/* A blob: URL from the API; next/image cannot optimize it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.src} alt="" className="size-full object-contain" />
            </button>
          )}
          {/* Keyed per step: the buttons of one step are never reused as the other's. */}
          {step === "destination" ? (
            <div key="destination" className="contents">
              <Button variant="secondary" busy={busy} onClick={() => void create(DEFAULT_LOOK)}>
                {w.skipDesign}
              </Button>
              <Button type="submit" form={formId}>
                {w.next}
              </Button>
            </div>
          ) : (
            <div key="design" className="contents">
              <Button variant="secondary" onClick={() => !busy && go("destination")}>
                {w.back}
              </Button>
              <Button type="submit" form={formId} busy={busy}>
                {t.create}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
