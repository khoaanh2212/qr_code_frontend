import { DEFAULT_LOOK, designFromLook, lookFromDesign } from "@/features/codes/design";
import type { CodeDesign } from "@/lib/api/types";
import { ECC_LEVELS, FRAME_MARGIN_MIN, MARGIN_MAX, type Ecc, type QrDesign } from "@/lib/qr/types";

/**
 * A template's design as generator state. The template's ecc and margin apply when it has them
 * (templates saved from a code have neither: the current ones stay); a frame keeps the margin at
 * 2 or more. An uploaded logo stays only when the template has no icon of its own.
 */
export function applyTemplate(current: QrDesign, template: CodeDesign): QrDesign {
  const look = lookFromDesign(template);
  const ecc = ECC_LEVELS.includes(template.ecc as Ecc) ? (template.ecc as Ecc) : current.ecc;
  const saved =
    typeof template.margin === "number" && template.margin >= 0 && template.margin <= MARGIN_MAX ? template.margin : current.margin;
  const margin = look.frame === "none" ? saved : Math.max(saved, FRAME_MARGIN_MIN);
  return {
    ...current,
    ...look,
    ecc,
    margin,
    logo: look.logoIcon ? undefined : current.logo,
  };
}

/** The generator's design as a template (an uploaded logo cannot be saved). */
export function templateFromDesign(design: QrDesign): CodeDesign {
  const out = designFromLook({ ...DEFAULT_LOOK, ...design, logoIcon: design.logo ? "" : design.logoIcon });
  return { ...out, ecc: design.ecc, margin: design.margin };
}
