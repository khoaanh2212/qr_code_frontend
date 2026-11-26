"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { GRADIENT_ANGLE_MAX, type QrDesign } from "@/lib/qr/types";
import { ColorInput } from "./color-input";

type T = Messages["generator"];

/** The part of a design these fields edit. */
export type ColorValue = Pick<
  QrDesign,
  | "fg"
  | "bg"
  | "gradient"
  | "fg2"
  | "gradientAngle"
  | "gradientStops"
  | "transparent"
>;

type Fill = "solid" | "linear" | "radial";

/**
 * The code's colors: its fill (one color, or a linear or radial gradient to a second one) and its
 * background (a color, or none). A stored design with more gradient colors shows the first and
 * last; editing either replaces the stops with those two.
 */
export function ColorFields({
  t,
  value,
  onChange,
  labels,
}: {
  t: T;
  value: ColorValue;
  onChange: (update: (v: ColorValue) => Partial<ColorValue>) => void;
  /** Names of the two main colors when the caller has its own ("Code color"). */
  labels?: { fg: string; bg: string };
}) {
  const d = t.design;
  const ids = { angle: useId(), transparentHelp: useId() };
  const fill: Fill = value.gradient || "solid";
  const stops = value.gradient ? value.gradientStops : null;
  // Stored stops are shown as their first and last colors; editing either replaces them.
  const start = stops ? stops[0].color : value.fg;
  const end = stops ? stops[stops.length - 1].color : value.fg2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {/* The group's legend is read by screen readers; this is its visible twin. */}
        <span aria-hidden="true" className="text-sm font-medium">
          {d.fill}
        </span>
        <SegmentedControl<Fill>
          legend={d.fill}
          value={fill}
          options={[
            { value: "solid", label: d.fillSolid },
            { value: "linear", label: d.fillLinear },
            { value: "radial", label: d.fillRadial },
          ]}
          onChange={(f) =>
            onChange(() => ({ gradient: f === "solid" ? "" : f }))
          }
        />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <ColorInput
          t={t}
          label={value.gradient ? d.fgStart : (labels?.fg ?? d.fg)}
          value={start}
          onChange={(fg) => onChange(() => ({ fg, gradientStops: null }))}
        />
        {value.gradient && (
          <ColorInput
            t={t}
            label={d.fg2}
            value={end}
            // Editing the end color keeps the start color shown, not the hidden stored fg.
            onChange={(fg2) =>
              onChange(() => ({ fg: start, fg2, gradientStops: null }))
            }
          />
        )}
      </div>
      {stops && (
        <p className="text-xs text-muted">
          {format(d.gradientStopsNote, { count: stops.length })}
        </p>
      )}
      {value.gradient === "linear" && (
        <div className="flex max-w-xs flex-col gap-1.5">
          <label htmlFor={ids.angle} className="text-sm font-medium">
            {d.gradientAngle}:{" "}
            <span className="font-mono tabular-nums">
              {value.gradientAngle}°
            </span>
          </label>
          <input
            id={ids.angle}
            type="range"
            min={0}
            max={GRADIENT_ANGLE_MAX}
            step={1}
            value={value.gradientAngle}
            onChange={(e) => {
              const gradientAngle = Number(e.target.value);
              onChange(() => ({ gradientAngle }));
            }}
            className="accent-accent"
          />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <ColorInput
          t={t}
          label={labels?.bg ?? d.bg}
          value={value.bg}
          disabled={value.transparent}
          onChange={(bg) => onChange(() => ({ bg }))}
        />
        <Checkbox
          label={d.transparent}
          checked={value.transparent}
          aria-describedby={value.transparent ? ids.transparentHelp : undefined}
          onChange={(e) => {
            const transparent = e.target.checked;
            onChange(() => ({ transparent }));
          }}
        />
      </div>
      {value.transparent && (
        <p id={ids.transparentHelp} className="text-xs text-muted">
          {d.transparentHelp}
        </p>
      )}
    </div>
  );
}
