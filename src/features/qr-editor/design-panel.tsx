"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Messages } from "@/i18n/messages";
import { LogoError, readLogo } from "@/lib/qr/logo";
import { ECC_LEVELS, FRAME_MARGIN_MIN, MARGIN_MAX, type Ecc, type QrDesign } from "@/lib/qr/types";
import { ColorFields } from "./color-fields";
import { LogoIconPicker } from "./logo-icons";
import { StylePicker } from "./style-picker";

type T = Messages["generator"];

export function DesignPanel({
  t,
  design,
  onChange,
  contrastOk,
  error,
  captionAction,
}: {
  t: T;
  design: QrDesign;
  onChange: Dispatch<SetStateAction<QrDesign>>;
  contrastOk: boolean;
  /** Server-side error of a design field ("fg", "bg", "margin", "logo"). */
  error?: { field: string; message: string };
  /** Under the frame caption (e.g. a sign-in link when the caption needs an account). */
  captionAction?: ReactNode;
}) {
  const ids = { ecc: useId(), margin: useId(), logo: useId(), logoHelp: useId(), logoError: useId() };
  const [logoError, setLogoError] = useState<string | null>(null);
  const shownLogoError = logoError ?? (error?.field === "logo" ? error.message : null);
  const eccLabels: Record<Ecc, string> = t.design.eccLevels;

  // Adding or removing the logo swaps the control under the user's focus: move focus to the
  // control that replaced it.
  const fileRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const hasLogo = Boolean(design.logo);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (hasLogo ? removeRef.current : fileRef.current)?.focus();
  }, [hasLogo]);

  return (
    <div className="flex flex-col gap-5">
      <ColorFields t={t} value={design} onChange={(update) => onChange((d) => ({ ...d, ...update(d) }))} />
      {/* The preview's status announces this; here it is shown next to the colors. */}
      {!contrastOk && <p className="text-sm font-medium text-warning">{t.design.lowContrast}</p>}
      {error && error.field !== "logo" && error.field !== "frame_text" && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error.message}
        </p>
      )}

      <StylePicker t={t} design={design} onChange={onChange} error={error} captionAction={captionAction} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.ecc} className="text-sm font-medium">
            {t.design.ecc}
          </label>
          <select
            id={ids.ecc}
            value={design.logo || design.logoIcon ? "H" : design.ecc}
            disabled={hasLogo || Boolean(design.logoIcon)}
            onChange={(e) => {
              const ecc = e.target.value as Ecc;
              onChange((d) => ({ ...d, ecc }));
            }}
            className="rounded-md border border-control bg-surface px-3 py-2 disabled:opacity-60"
          >
            {ECC_LEVELS.map((level) => (
              <option key={level} value={level}>
                {eccLabels[level]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.margin} className="text-sm font-medium">
            {t.design.margin}: <span className="font-mono tabular-nums">{design.margin}</span>
          </label>
          <input
            id={ids.margin}
            type="range"
            min={design.frame === "none" ? 0 : FRAME_MARGIN_MIN}
            max={MARGIN_MAX}
            value={design.margin}
            onChange={(e) => {
              const margin = Number(e.target.value);
              onChange((d) => ({ ...d, margin }));
            }}
            className="mt-3 accent-accent"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t.design.logo}</span>
        {design.logo ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="max-w-60 truncate font-mono">{design.logo.name}</span>
            <button
              ref={removeRef}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-control px-3 py-1.5 hover:bg-foreground/5"
              onClick={() => {
                moveFocus.current = true;
                onChange((d) => ({ ...d, logo: undefined }));
              }}
            >
              <X aria-hidden="true" className="size-4" />
              {t.design.logoRemove}
            </button>
          </div>
        ) : (
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-control bg-surface px-3 py-2 text-sm font-medium hover:bg-foreground/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
            <ImagePlus aria-hidden="true" className="size-4" />
            {t.design.logoUpload}
            <input
              ref={fileRef}
              id={ids.logo}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              aria-describedby={[ids.logoHelp, shownLogoError && ids.logoError].filter(Boolean).join(" ")}
              aria-invalid={shownLogoError ? true : undefined}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const logo = await readLogo(file);
                  setLogoError(null);
                  moveFocus.current = true;
                  // An uploaded logo replaces a built-in icon.
                  onChange((d) => ({ ...d, logo, logoIcon: "" }));
                } catch (err) {
                  setLogoError(err instanceof LogoError && err.reason === "size" ? t.design.logoSize : t.design.logoType);
                }
              }}
            />
          </label>
        )}
        <p id={ids.logoHelp} className="text-xs text-muted">
          {design.logo || design.logoIcon ? t.design.logoEcc : t.design.logoHelp}
        </p>
        {shownLogoError && (
          <p id={ids.logoError} role="alert" className="text-xs font-medium text-danger">
            {shownLogoError}
          </p>
        )}
      </div>
      {!design.logo && (
        <LogoIconPicker t={t} value={design.logoIcon} onPick={(logoIcon) => onChange((d) => ({ ...d, logoIcon }))} />
      )}
    </div>
  );
}
