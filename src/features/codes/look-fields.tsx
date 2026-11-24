"use client";

import { ColorInput } from "@/features/qr-editor/color-input";
import { LogoIconPicker } from "@/features/qr-editor/logo-icons";
import { StylePicker } from "@/features/qr-editor/style-picker";
import type { Messages } from "@/i18n/messages";
import { isScannable } from "@/lib/qr/color";
import { TemplateBar } from "@/features/templates/template-bar";
import { designFromLook, lookFromDesign, lookScannable, type CodeLook } from "./design";
import type { CodeField } from "./errors";

/** Colors and style of a dynamic code, with the contrast and caption messages. */
export function LookFields({
  t,
  generator,
  look,
  onChange,
  error,
  templates,
}: {
  t: Messages["codes"];
  generator: Messages["generator"];
  look: CodeLook;
  onChange: (update: (l: CodeLook) => CodeLook) => void;
  error?: { field?: CodeField; message: string } | null;
  /** Offers the workspace's design templates above the fields. */
  templates?: { t: Messages["templates"]; workspaceId: string };
}) {
  const contrastOk = isScannable(look.fg, look.bg);
  return (
    <div className="flex flex-col gap-5">
      {templates && (
        <TemplateBar
          t={templates.t}
          workspaceId={templates.workspaceId}
          currentDesign={() => designFromLook(look)}
          onApply={(d) => onChange(() => lookFromDesign(d))}
        />
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">
          {t.foreground}, {t.background}
        </legend>
        <div className="flex flex-wrap gap-6">
          <ColorInput t={generator} label={t.foreground} value={look.fg} onChange={(fg) => onChange((l) => ({ ...l, fg }))} />
          <ColorInput t={generator} label={t.background} value={look.bg} onChange={(bg) => onChange((l) => ({ ...l, bg }))} />
        </div>
        {(!contrastOk || error?.field === "colors") && (
          <p className="text-xs font-medium text-danger">{contrastOk ? error?.message : t.lowContrast}</p>
        )}
      </fieldset>
      {contrastOk && !lookScannable(look) && <p className="text-xs font-medium text-danger">{t.lowContrast}</p>}
      <StylePicker
        t={generator}
        design={look}
        onChange={onChange}
        error={error?.field === "frame_text" ? { field: "frame_text", message: generator.design.frameTextInvalid } : undefined}
      />
      <LogoIconPicker t={generator} value={look.logoIcon} onPick={(logoIcon) => onChange((l) => ({ ...l, logoIcon }))} />
    </div>
  );
}
