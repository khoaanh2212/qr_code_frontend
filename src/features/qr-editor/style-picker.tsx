"use client";

import { useId, type ReactNode } from "react";
import type { Messages } from "@/i18n/messages";
import {
  EYES,
  FRAME_MARGIN_MIN,
  FRAME_TEXT_MAX,
  FRAMES,
  MODULES,
  type QrDesign,
  type QrEye,
  type QrFrame,
  type QrModule,
} from "@/lib/qr/types";

type T = Messages["generator"];

/** The part of a design the picker edits. */
export type StyleDesign = Pick<QrDesign, "module" | "eye" | "frame" | "frameText" | "margin">;

/**
 * Pattern, eye shape and frame (with its caption), as rows of radio cards that show the shape.
 * Choosing a frame widens a too-thin quiet zone and fills in the localized caption.
 */
export function StylePicker<D extends StyleDesign>({
  t,
  design,
  onChange,
  error,
}: {
  t: T;
  design: D;
  onChange: (update: (d: D) => D) => void;
  /** Server-side error of a style field ("module", "eye", "frame", "frame_text"). */
  error?: { field: string; message: string };
}) {
  const captionId = useId();
  const captionHelp = useId();
  const captionError = error?.field === "frame_text" ? error.message : undefined;
  const names = t.design.styles;

  return (
    <div className="flex flex-col gap-5">
      <Choices
        legend={t.design.module}
        name="module"
        values={MODULES}
        value={design.module}
        label={(v) => names.modules[v]}
        thumb={(v) => <ModuleThumb shape={v} />}
        onPick={(module) => onChange((d) => ({ ...d, module }))}
      />
      <Choices
        legend={t.design.eye}
        name="eye"
        values={EYES}
        value={design.eye}
        label={(v) => names.eyes[v]}
        thumb={(v) => <EyeThumb shape={v} />}
        onPick={(eye) => onChange((d) => ({ ...d, eye }))}
      />
      <Choices
        legend={t.design.frame}
        name="frame"
        values={FRAMES}
        value={design.frame}
        label={(v) => names.frames[v]}
        thumb={(v) => <FrameThumb frame={v} />}
        onPick={(frame) =>
          onChange((d) => ({
            ...d,
            frame,
            margin: frame === "none" ? d.margin : Math.max(d.margin, FRAME_MARGIN_MIN),
            frameText: frame !== "none" && d.frameText === "" ? t.design.frameTextDefault : d.frameText,
          }))
        }
      />
      {design.frame !== "none" && (
        <div className="flex max-w-sm flex-col gap-1.5">
          <label htmlFor={captionId} className="text-sm font-medium">
            {t.design.frameText}
          </label>
          <input
            id={captionId}
            value={design.frameText}
            maxLength={FRAME_TEXT_MAX}
            autoComplete="off"
            aria-invalid={captionError ? true : undefined}
            aria-describedby={captionHelp}
            onChange={(e) => {
              const frameText = e.target.value;
              onChange((d) => ({ ...d, frameText }));
            }}
            className="min-h-11 rounded-md border border-control bg-surface px-3 text-base aria-[invalid=true]:border-danger"
          />
          <p id={captionHelp} aria-live="polite" className={`text-xs ${captionError ? "font-medium text-danger" : "text-muted"}`}>
            {captionError ?? t.design.frameTextHelp}
          </p>
        </div>
      )}
    </div>
  );
}

function Choices<V extends string>({
  legend,
  name,
  values,
  value,
  label,
  thumb,
  onPick,
}: {
  legend: string;
  name: string;
  values: readonly V[];
  value: V;
  label: (v: V) => string;
  thumb: (v: V) => ReactNode;
  onPick: (v: V) => void;
}) {
  const group = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 min-[25rem]:grid-cols-4">
        {values.map((v) => (
          <label
            key={v}
            className="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-1 py-2.5 text-center text-xs font-medium text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={`${group}-${name}`}
              value={v}
              checked={value === v}
              onChange={() => onPick(v)}
              className="sr-only"
            />
            <span aria-hidden="true" className="text-foreground">
              {thumb(v)}
            </span>
            <span className="w-full truncate">{label(v)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Thumbnails: a few modules or one eye in the shape, drawn in the text color.

const THUMB = "size-8";
/** A 4x4 corner of a code: which cells are dark. */
const SAMPLE = ["1101", "0111", "1010", "1110"];

function ModuleThumb({ shape }: { shape: QrModule }) {
  const cells: ReactNode[] = [];
  SAMPLE.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "1") return;
      const key = `${x}-${y}`;
      if (shape === "dots") cells.push(<circle key={key} cx={x + 0.5} cy={y + 0.5} r={0.42} />);
      else if (shape === "rounded") cells.push(<rect key={key} x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.35} />);
      else if (shape === "bars") cells.push(<rect key={key} x={x + 0.12} y={y} width={0.76} height={1} rx={0.38} />);
      else cells.push(<rect key={key} x={x} y={y} width={1} height={1} />);
    }),
  );
  return (
    <svg viewBox="-0.5 -0.5 5 5" className={THUMB} fill="currentColor">
      {cells}
    </svg>
  );
}

function EyeThumb({ shape }: { shape: QrEye }) {
  const r = { square: [0, 0, 0], rounded: [2, 1.2, 0.9], circle: [3.5, 2.5, 1.5], leaf: [3, 2, 1.3] }[shape];
  const box = (x: number, s: number, radius: number) =>
    shape === "leaf"
      ? `M${x + radius} ${x}H${x + s}V${x + s - radius}A${radius} ${radius} 0 0 1 ${x + s - radius} ${x + s}H${x}V${x + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${x}Z`
      : `M${x + radius} ${x}H${x + s - radius}A${radius} ${radius} 0 0 1 ${x + s} ${x + radius}V${x + s - radius}A${radius} ${radius} 0 0 1 ${x + s - radius} ${x + s}H${x + radius}A${radius} ${radius} 0 0 1 ${x} ${x + s - radius}V${x + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${x}Z`;
  return (
    <svg viewBox="-0.5 -0.5 8 8" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={`${box(0, 7, r[0])}${box(1, 5, r[1])}`} />
      <path d={box(2, 3, r[2])} />
    </svg>
  );
}

function FrameThumb({ frame }: { frame: QrFrame }) {
  const code = (y: number) => (
    <g transform={`translate(4.5 ${y})`}>
      <rect width="3" height="3" />
      <rect x="4" width="3" height="3" />
      <rect y="4" width="3" height="3" />
      <rect x="4.5" y="4.5" width="2" height="2" />
    </g>
  );
  if (frame === "none") {
    return (
      <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor">
        {code(4.5)}
      </svg>
    );
  }
  if (frame === "box") {
    return (
      <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor">
        <rect x="2.5" y="0.5" width="11" height="11" rx="1.2" fill="none" stroke="currentColor" />
        <g transform="translate(-1.5 -1.5)">{code(3.5)}</g>
        <rect x="4" y="13" width="8" height="1.6" rx="0.8" />
      </svg>
    );
  }
  const top = frame === "label-top";
  return (
    <svg viewBox="0 0 16 16" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={`M3 0h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1Z${top ? "M3 4.5h10v10.5H3Z" : "M3 1h10v10.5H3Z"}`} />
      <g transform={`translate(-0.5 ${top ? 1 : -2.5})`}>{code(4.5)}</g>
    </svg>
  );
}
