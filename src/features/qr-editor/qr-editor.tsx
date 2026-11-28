"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useCallback, useId, useMemo, useState } from "react";
import { saveHandoff } from "@/features/codes/handoff";
import { Switch } from "@/components/ui/switch";
import { applyTemplate, templateFromDesign } from "@/features/templates/convert";
import { GeneratorTemplates } from "@/features/templates/generator-templates";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { buildRenderRequest, missingRequired, requestKey } from "@/lib/qr/render-request";
import { isSocialNetwork, socialUrl } from "@/lib/qr/social";
import { downloadName, normalizeUrlInput, validateFields, type FieldProblem } from "@/lib/qr/validate";
import { DEFAULT_DESIGN, designScannable, type QrData, type QrDesign, type QrType } from "@/lib/qr/types";
import { DesignPanel } from "./design-panel";
import { errorText } from "./error-text";
import { ContentFields, fieldText, initialData } from "./fields";
import { MobilePreviewBar } from "./mobile-preview-bar";
import { PagePromo } from "./page-promo";
import { PreviewPanel, type Blocker } from "./preview-panel";
import { pageTab, TypePicker } from "./type-picker";
import { useQrTypes } from "./use-qr-types";
import { useRenderPreview } from "./use-render";

type T = Messages["generator"];

const DESIGN_FIELDS = new Set([
  "fg",
  "bg",
  "margin",
  "ecc",
  "logo",
  "size",
  "module",
  "eye_frame",
  "eye_ball",
  "eye_color",
  "eye_ball_color",
  "frame",
  "frame_text",
  "frame_color",
  "logo_icon",
  "gradient",
  "fg2",
  "gradient_angle",
  "gradient_stops",
]);
const URL_FIELDS = new Set(["url", "website"]);
/** The static types a dynamic code can lead to: the switch "Track scans" is offered for them. */
const TRACKABLE = new Set(["url", "social"]);
/** Hosted page types offered as tabs after the static ones (backend PLAN item 27d). */
const PAGE_TABS = ["contact", "business", "pdf", "links", "menu", "app"] as const;
const PREVIEW_ID = "qr-preview";

// Typing the content changes only the content and the preview: the design controls (the style
// picker draws dozens of SVG thumbnails) and the type cards are memoized here, where their props
// are kept stable.
const DesignPanelMemo = memo(DesignPanel);
const TypePickerMemo = memo(TypePicker);
const PREVIEW_SIZE = 512;

/**
 * The static QR code generator: pick a type, fill in its fields, adjust the design, download.
 * The page never depends on the session: renders go through `publicApi`. Two parts use the
 * session cookie, at runtime and only on the person's request (the ESLint exception in
 * eslint.config.mjs): a frame caption of their own (`use-render.ts`, POST /v1/me/qr/render) and
 * the design templates section (`generator-templates.tsx`).
 * `initialType` opens it on that type (per-type pages); unknown types fall back to the first.
 */
export function QrEditor({
  t,
  templates,
  pageTypes,
  initialType,
  locale,
}: {
  t: T;
  /** Messages of design templates; without them the generator offers none. */
  templates?: Messages["templates"];
  /** Names of the hosted page types; without them the generator offers no page tabs. */
  pageTypes?: Messages["pages"]["types"];
  initialType?: string;
  locale: Locale;
}) {
  const { state, reload } = useQrTypes();

  if (state.kind === "loading") return <EditorSkeleton label={t.loading} />;
  if (state.kind === "error" || state.catalog.types.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
        <p className="font-medium">{t.errors.loadTypes}</p>
        {state.kind === "error" && <p className="text-sm text-muted">{errorText(state.error, t)}</p>}
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-md border border-control px-3 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          <RotateCw aria-hidden="true" className="size-4" />
          {t.errors.retry}
        </button>
      </div>
    );
  }
  return <Editor t={t} templates={templates} pageTypes={pageTypes} types={state.catalog.types} initialType={initialType} locale={locale} />;
}

function Editor({
  t,
  templates,
  pageTypes,
  types,
  initialType,
  locale,
}: {
  t: T;
  templates?: Messages["templates"];
  pageTypes?: Messages["pages"]["types"];
  types: QrType[];
  initialType?: string;
  locale: Locale;
}) {
  const headingIds = { content: useId(), design: useId() };
  const [typeName, setTypeName] = useState(
    () => types.find((x) => x.type === initialType)?.type ?? types[0].type,
  );
  const [dataByType, setDataByType] = useState<Record<string, QrData>>({});
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [track, setTrack] = useState(false);
  // Every type starts with scan tracking off: the switch never hides a download unseen.
  const pickType = useCallback((type: string) => {
    setTypeName(type);
    setTrack(false);
  }, []);
  const pageTabs = useMemo(
    () =>
      pageTypes
        ? PAGE_TABS.map((name) => {
            const words = (pageTypes as Record<string, { name: string; help: string } | undefined>)[name];
            return { name, label: words?.name ?? name, help: words?.help ?? "" };
          })
        : [],
    [pageTypes],
  );
  const openPage = pageTabs.find((p) => pageTab(p.name) === typeName) ?? null;

  const qrType = types.find((x) => x.type === typeName) ?? types[0];
  const data = useMemo(() => dataByType[qrType.type] ?? initialData(qrType), [dataByType, qrType]);
  const missing = useMemo(() => missingRequired(qrType, data), [qrType, data]);
  const problems = useMemo(() => validateFields(qrType, data), [qrType, data]);
  const problemNames = Object.keys(problems);
  const contrastOk = designScannable(design);

  const contentOk = missing.length === 0 && problemNames.length === 0;
  // A hosted page tab draws no code: nothing to render behind it.
  const canRender = !openPage && contentOk && contrastOk;
  const trackable = TRACKABLE.has(qrType.type);
  const request = useMemo(
    () =>
      canRender ? buildRenderRequest({ type: qrType.type, data, design, format: "png", size: PREVIEW_SIZE }) : null,
    [canRender, qrType.type, data, design],
  );
  const key = useMemo(() => (request ? requestKey(request, design.logo?.id) : null), [request, design.logo?.id]);
  const preview = useRenderPreview(request, key, qrType.type);

  // A caption of the user's own goes to the signed-in render; 401 means "sign in first".
  const captionNeedsSignIn = preview.error?.status === 401;
  const serverField = captionNeedsSignIn
    ? "frame_text"
    : preview.error?.code === "validation_error"
      ? preview.error.field
      : undefined;
  const pathname = usePathname();
  const serverContentField = serverField && !DESIGN_FIELDS.has(serverField) ? serverField : undefined;

  // What blocks a printable code, first problem first.
  const touchedName = (name: string) => Boolean(touched[`${qrType.type}.${name}`]);
  const invalidName = problemNames[0] ?? serverContentField;
  let blocker: Blocker = null;
  if (missing.length > 0) blocker = "incomplete";
  else if (invalidName) blocker = "invalid";
  else if (!contrastOk) blocker = "lowContrast";
  else if (serverField) blocker = "invalid";
  const invalidField = invalidName ? qrType.fields.find((f) => f.name === invalidName) : undefined;
  const invalidLabel = invalidField
    ? fieldText(t, qrType.type, invalidField).label
    : serverField === "frame_text"
      ? t.design.frameText
      : undefined;

  // Field messages: shown once, at the field, after the user has left it (or the API refused it).
  const problemText: Record<FieldProblem, string> = {
    url: t.validation.url,
    email: t.validation.email,
    phone: t.validation.phone,
    ssidBytes: t.validation.ssidBytes,
    wpa: t.validation.wpa,
    socialUsername: t.validation.socialUsername,
    socialText: t.validation.socialText,
  };
  const fieldErrors: Record<string, string> = {};
  for (const name of missing) {
    if (touchedName(name)) {
      fieldErrors[name] = qrType.type === "vcard" && name === "first_name" ? t.validation.vcardName : t.validation.required;
    }
  }
  for (const name of problemNames) {
    if (touchedName(name)) fieldErrors[name] = problemText[problems[name]];
  }
  if (serverContentField) fieldErrors[serverContentField] ??= t.validation.invalid;
  const designError = useMemo(
    () =>
      serverField && DESIGN_FIELDS.has(serverField)
        ? {
            field: serverField,
            message:
              serverField === "logo"
                ? t.design.logoType
                : serverField === "frame_text"
                  ? captionNeedsSignIn
                    ? t.design.frameTextSignIn
                    : t.design.frameTextInvalid
                  : t.validation.invalid,
          }
        : undefined,
    [serverField, captionNeedsSignIn, t],
  );
  const captionAction = useMemo(
    () =>
      captionNeedsSignIn && (
        <Link
          href={`${localizePath(locale, "/login")}?return_to=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {t.design.frameTextSignInLink}
        </Link>
      ),
    [captionNeedsSignIn, locale, pathname, t],
  );
  const currentTemplateDesign = useCallback(() => templateFromDesign(design), [design]);
  const applyTemplateDesign = useCallback(
    (d: Parameters<typeof applyTemplate>[1]) => setDesign((current) => applyTemplate(current, d)),
    [],
  );

  const setField = (name: string, value: string) =>
    setDataByType((prev) => ({
      ...prev,
      [qrType.type]: { ...(prev[qrType.type] ?? initialData(qrType)), [name]: value },
    }));

  return (
    // One bounded card (type row, then content and design beside the preview), so the page keeps
    // room below the generator for the rest of its content.
    <div className="grid gap-6 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8">
      <div className="min-w-0 lg:col-span-2">
        <TypePickerMemo t={t} types={types} pages={pageTabs} value={openPage ? typeName : qrType.type} onChange={pickType} />
      </div>
      {openPage ? (
        <PagePromo t={t} type={openPage.name} name={openPage.label} help={openPage.help} locale={locale} />
      ) : (
      <>
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby={headingIds.content} className="flex flex-col gap-4">
          <h2 id={headingIds.content} className="flex items-center gap-2.5 text-lg font-semibold">
            <StepNumber n={1} />
            {t.sections.content}
          </h2>
          <ContentFields
            t={t}
            qrType={qrType}
            data={data}
            errors={fieldErrors}
            onChange={setField}
            onBlur={(name) => {
              if (URL_FIELDS.has(name)) {
                const value = data[name] ?? "";
                const normalized = normalizeUrlInput(value);
                if (normalized !== value) setField(name, normalized);
              }
              setTouched((prev) => ({ ...prev, [`${qrType.type}.${name}`]: true }));
            }}
          />
          {trackable && <Switch label={t.trackScans} help={t.trackScansHelp} checked={track} onChange={setTrack} />}
        </section>
      </div>

      <section aria-labelledby={headingIds.design} className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-3">
        <h2 id={headingIds.design} className="flex items-center gap-2.5 text-lg font-semibold">
          <StepNumber n={2} />
          {t.sections.design}
        </h2>
        {templates && (
          <GeneratorTemplates
            t={templates}
            locale={locale}
            currentDesign={currentTemplateDesign}
            onApply={applyTemplateDesign}
          />
        )}
        <DesignPanelMemo
          t={t}
          design={design}
          onChange={setDesign}
          contrastOk={contrastOk}
          error={designError}
          captionAction={captionAction}
        />
      </section>

      <aside
        id={PREVIEW_ID}
        className="scroll-mt-6 rounded-lg border border-border bg-background p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:col-start-2 lg:row-span-2 lg:row-start-2"
      >
        <PreviewPanel
          t={t}
          preview={preview}
          blocker={blocker}
          invalidLabel={invalidLabel}
          contentKey={key ?? blocker ?? ""}
          filename={downloadName(qrType.type, data)}
          design={design}
          buildDownload={(format, size) =>
            buildRenderRequest({ type: qrType.type, data, design, format, size }, { post: true })
          }
          tracked={
            trackable && track ? (
              <TrackedCode
                t={t}
                href={localizePath(locale, "/app/codes/new")}
                ready={contentOk}
                onFollow={() => saveHandoff(handoffOf(qrType.type, data, design))}
              />
            ) : undefined
          }
        />
      </aside>

      <MobilePreviewBar t={t} src={blocker === null && !preview.error ? preview.src : null} targetId={PREVIEW_ID} />
      </>
      )}
    </div>
  );
}

/** The step's number beside its heading; the heading itself says what the step is. */
function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-sm text-background"
    >
      {n}
    </span>
  );
}

/** What "New code" starts from: the destination (a website, or a social profile's link) and the look. */
function handoffOf(type: string, data: QrData, design: QrDesign) {
  const url =
    type === "social" && isSocialNetwork(data.network)
      ? socialUrl({ network: data.network, username: data.username ?? "", text: data.text ?? "" })
      : (data.url ?? "");
  return {
    url,
    fg: design.fg,
    bg: design.bg,
    style: {
      module: design.module,
      eyeFrames: design.eyeFrames,
      eyeBalls: design.eyeBalls,
      eyeColor: design.eyeColor,
      eyeBallColor: design.eyeBallColor,
      frame: design.frame,
      frameText: design.frameText,
      frameColor: design.frameColor,
      gradient: design.gradient,
      fg2: design.fg2,
      gradientAngle: design.gradientAngle,
      transparent: design.transparent,
      // An uploaded logo stays in this tab; an icon travels.
      logoIcon: design.logo ? "" : design.logoIcon,
    },
  };
}

/**
 * In place of the static download while "Track scans" is on: a tracked code is a dynamic one,
 * made in a free account. The content and look go along (sessionStorage), and login or sign-up
 * in between returns to the new-code form.
 */
function TrackedCode({ t, href, ready, onFollow }: { t: T; href: string; ready: boolean; onFollow: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <h2 className="text-lg font-semibold">{t.trackScans}</h2>
      <p className="text-sm text-pretty text-muted">{t.trackScansNote}</p>
      {ready && (
        <Link
          href={href}
          onClick={onFollow}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
        >
          {t.trackScansContinue}
        </Link>
      )}
    </div>
  );
}

function EditorSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid gap-6 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-8"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-8">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-11 w-24 shrink-0 rounded-full bg-foreground/5" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-5 w-24 rounded bg-foreground/5" />
          <div className="h-10 rounded-md bg-foreground/5" />
        </div>
      </div>
      <div aria-hidden="true" className="h-[30rem] animate-pulse rounded-lg bg-foreground/5" />
    </div>
  );
}
