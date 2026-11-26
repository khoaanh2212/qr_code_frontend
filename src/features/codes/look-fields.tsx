"use client";

import { ColorFields } from "@/features/qr-editor/color-fields";
import { LogoIconPicker } from "@/features/qr-editor/logo-icons";
import { StylePicker } from "@/features/qr-editor/style-picker";
import type { Messages } from "@/i18n/messages";
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
  const contrastOk = lookScannable(look);
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
        <ColorFields
          t={generator}
          value={look}
          labels={{ fg: t.foreground, bg: t.background }}
          onChange={(update) => onChange((l) => ({ ...l, ...update(l) }))}
        />
        {(!contrastOk || error?.field === "colors") && (
          <p className="text-xs font-medium text-danger">{contrastOk ? error?.message : t.lowContrast}</p>
        )}
      </fieldset>
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
