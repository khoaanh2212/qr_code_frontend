"use client";

import { RotateCw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { isScannable } from "@/lib/qr/color";
import { buildRenderRequest, missingRequired, requestKey } from "@/lib/qr/render-request";
import { DEFAULT_DESIGN, type QrData, type QrDesign, type QrType } from "@/lib/qr/types";
import { DesignPanel } from "./design-panel";
import { errorText } from "./error-text";
import { ContentFields, initialData } from "./fields";
import { PreviewPanel, type Blocker } from "./preview-panel";
import { TypePicker } from "./type-picker";
import { useQrTypes } from "./use-qr-types";
import { useRenderPreview } from "./use-render";

type T = Messages["generator"];

const DESIGN_FIELDS = new Set(["fg", "bg", "margin", "ecc", "logo", "size"]);
const PREVIEW_SIZE = 512;

/**
 * The static QR code generator: pick a type, fill in its fields, adjust the design, download.
 * Public and session-free: talks to the API through `publicApi` only.
 */
export function QrEditor({ t }: { t: T }) {
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
  return <Editor t={t} types={state.catalog.types} />;
}

function Editor({ t, types }: { t: T; types: QrType[] }) {
  const headingIds = { content: useId(), design: useId() };
  const [typeName, setTypeName] = useState(types[0].type);
  const [dataByType, setDataByType] = useState<Record<string, QrData>>({});
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);

  const qrType = types.find((x) => x.type === typeName) ?? types[0];
  const data = useMemo(() => dataByType[qrType.type] ?? initialData(qrType), [dataByType, qrType]);
  const missing = missingRequired(qrType, data);
  const contrastOk = isScannable(design.fg, design.bg);
  const blocker: Blocker = missing.length > 0 ? "incomplete" : contrastOk ? null : "lowContrast";

  const request = useMemo(
    () =>
      blocker === null
        ? buildRenderRequest({ type: qrType.type, data, design, format: "png", size: PREVIEW_SIZE })
        : null,
    [blocker, qrType.type, data, design],
  );
  const key = useMemo(() => (request ? requestKey(request, design.logo?.id) : null), [request, design.logo?.id]);
  const preview = useRenderPreview(request, key);

  // Field errors: required fields the user has left, then what the API rejected.
  const fieldErrors: Record<string, string> = {};
  for (const name of missing) {
    if (touched[`${qrType.type}.${name}`]) fieldErrors[name] = t.validation.required;
  }
  const serverField = preview.error?.code === "validation_error" ? preview.error.field : undefined;
  if (serverField && !DESIGN_FIELDS.has(serverField)) fieldErrors[serverField] = t.validation.invalid;
  const designError =
    serverField && DESIGN_FIELDS.has(serverField)
      ? { field: serverField, message: serverField === "logo" ? t.design.logoType : t.validation.invalid }
      : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
      <div className="flex flex-col gap-8">
        <TypePicker t={t} types={types} value={qrType.type} onChange={setTypeName} />
        <section aria-labelledby={headingIds.content} className="flex flex-col gap-4">
          <h2 id={headingIds.content} className="text-lg font-semibold">
            {t.sections.content}
          </h2>
          <ContentFields
            t={t}
            qrType={qrType}
            data={data}
            errors={fieldErrors}
            onChange={(name, value) =>
              setDataByType((prev) => ({
                ...prev,
                [qrType.type]: { ...(prev[qrType.type] ?? initialData(qrType)), [name]: value },
              }))
            }
            onBlur={(name) => setTouched((prev) => ({ ...prev, [`${qrType.type}.${name}`]: true }))}
          />
        </section>
      </div>

      <aside className="rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <PreviewPanel
          t={t}
          preview={preview}
          blocker={blocker}
          filename={`qr-code-${qrType.type}`}
          buildDownload={(format, size) =>
            buildRenderRequest({ type: qrType.type, data, design, format, size }, { post: true })
          }
        />
      </aside>

      <section aria-labelledby={headingIds.design} className="flex flex-col gap-4 lg:col-start-1">
        <h2 id={headingIds.design} className="text-lg font-semibold">
          {t.sections.design}
        </h2>
        <DesignPanel t={t} design={design} onChange={setDesign} contrastOk={contrastOk} error={designError} />
      </section>
    </div>
  );
}

function EditorSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-8">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-[4.5rem] rounded-lg bg-foreground/5" />
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
