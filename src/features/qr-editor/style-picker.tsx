"use client";

import { useId, useState, type ReactNode } from "react";
import type { Messages } from "@/i18n/messages";
import {
  EYE_BALLS,
  EYE_FRAMES,
  eyePairAllowed,
  FRAME_MARGIN_MIN,
  FRAME_TEXT_MAX,
  FRAMES,
  MODULES,
  type EyeTriple,
  type QrDesign,
  type QrEyeBall,
  type QrEyeFrame,
  type QrFrame,
  type QrModule,
} from "@/lib/qr/types";
import { ColorInput } from "./color-input";

type T = Messages["generator"];

/** The part of a design the picker edits. */
export type StyleDesign = Pick<
  QrDesign,
  "fg" | "module" | "eyeFrames" | "eyeBalls" | "eyeColor" | "eyeBallColor" | "frame" | "frameText" | "frameColor" | "margin"
>;

const EYE_KEYS = ["tl", "tr", "bl"] as const;

function setAt<V>(t: EyeTriple<V>, i: number, v: V): EyeTriple<V> {
  const out = [...t] as [V, V, V];
  out[i] = v;
  return out;
}

/**
 * Pattern, eyes (ring and center, for all three or each one) with their own colors, and a frame
 * with its caption and color, as rows of radio cards that show the shape. Choosing a frame
 * widens a too-thin quiet zone and fills in the localized caption.
 */
export function StylePicker<D extends StyleDesign>({
  t,
  design,
  onChange,
  error,
  captionAction,
}: {
  t: T;
  design: D;
  onChange: (update: (d: D) => D) => void;
  /** Server-side error of a style field ("module", "eye_frame", "frame_text"...). */
  error?: { field: string; message: string };
  /** Shown under the caption's message (e.g. a sign-in link). */
  captionAction?: ReactNode;
}) {
  const captionId = useId();
  const captionHelp = useId();
  const captionError = error?.field === "frame_text" ? error.message : undefined;
  const names = t.design.styles;
  const [perEyeChosen, setPerEye] = useState(false);
  // Eyes that already differ (a loaded design) are always shown one by one.
  const perEye = perEyeChosen || new Set(design.eyeFrames).size > 1 || new Set(design.eyeBalls).size > 1;

  // A pick never leaves an eye in the pair the API refuses: the other part falls back to square.
  const pickFrame = (i: number | "all", frame: QrEyeFrame) =>
    onChange((d) => {
      let frames = d.eyeFrames;
      let balls = d.eyeBalls;
      for (const k of i === "all" ? [0, 1, 2] : [i]) {
        frames = setAt(frames, k, frame);
        if (!eyePairAllowed(frame, balls[k])) balls = setAt(balls, k, "square");
      }
      return { ...d, eyeFrames: frames, eyeBalls: balls };
    });
  const pickBall = (i: number | "all", ball: QrEyeBall) =>
    onChange((d) => {
      let frames = d.eyeFrames;
      let balls = d.eyeBalls;
      for (const k of i === "all" ? [0, 1, 2] : [i]) {
        balls = setAt(balls, k, ball);
        if (!eyePairAllowed(frames[k], ball)) frames = setAt(frames, k, "square");
      }
      return { ...d, eyeFrames: frames, eyeBalls: balls };
    });

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

      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1.5 text-sm font-semibold">{t.design.eye}</legend>
        <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={perEye}
            onChange={(e) => {
              setPerEye(e.target.checked);
              // Back to one setting: every eye takes the top-left one.
              if (!e.target.checked) {
                onChange((d) => ({
                  ...d,
                  eyeFrames: [d.eyeFrames[0], d.eyeFrames[0], d.eyeFrames[0]],
                  eyeBalls: [d.eyeBalls[0], d.eyeBalls[0], d.eyeBalls[0]],
                }));
              }
            }}
            className="size-4 accent-accent"
          />
          {t.design.perEye}
        </label>
        {perEye ? (
          <div className="flex flex-col gap-3">
            {EYE_KEYS.map((key, i) => (
              <fieldset key={key} className="grid min-w-0 gap-2 sm:grid-cols-[7rem_1fr_1fr] sm:items-end">
                <legend className="float-left text-sm font-medium sm:pb-3">{t.design.eyeNames[key]}</legend>
                <Select
                  label={t.design.eyeFrame}
                  values={EYE_FRAMES}
                  value={design.eyeFrames[i]}
                  name={(v) => names.eyeFrames[v]}
                  disabled={(v) => !eyePairAllowed(v, design.eyeBalls[i])}
                  onPick={(v) => pickFrame(i, v)}
                />
                <Select
                  label={t.design.eyeBall}
                  values={EYE_BALLS}
                  value={design.eyeBalls[i]}
                  name={(v) => names.eyeBalls[v]}
                  disabled={(v) => !eyePairAllowed(design.eyeFrames[i], v)}
                  onPick={(v) => pickBall(i, v)}
                />
              </fieldset>
            ))}
          </div>
        ) : (
          <>
            <Choices
              legend={t.design.eyeFrame}
              name="eye-frame"
              values={EYE_FRAMES}
              value={design.eyeFrames[0]}
              label={(v) => names.eyeFrames[v]}
              thumb={(v) => <EyeFrameThumb shape={v} />}
              disabled={(v) => !eyePairAllowed(v, design.eyeBalls[0])}
              onPick={(v) => pickFrame("all", v)}
            />
            <Choices
              legend={t.design.eyeBall}
              name="eye-ball"
              values={EYE_BALLS}
              value={design.eyeBalls[0]}
              label={(v) => names.eyeBalls[v]}
              thumb={(v) => <EyeBallThumb shape={v} />}
              disabled={(v) => !eyePairAllowed(design.eyeFrames[0], v)}
              onPick={(v) => pickBall("all", v)}
            />
          </>
        )}
        <OwnColors
          label={t.design.eyeColors}
          on={design.eyeColor !== "" || design.eyeBallColor !== ""}
          onToggle={(on) => onChange((d) => ({ ...d, eyeColor: on ? d.fg : "", eyeBallColor: on ? d.fg : "" }))}
        >
          <ColorInput
            t={t}
            label={t.design.eyeColor}
            value={design.eyeColor || design.fg}
            onChange={(c) => onChange((d) => ({ ...d, eyeColor: c }))}
          />
          <ColorInput
            t={t}
            label={t.design.eyeBallColor}
            value={design.eyeBallColor || design.fg}
            onChange={(c) => onChange((d) => ({ ...d, eyeBallColor: c }))}
          />
        </OwnColors>
      </fieldset>

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
        <>
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
            {captionAction}
          </div>
          <OwnColors
            label={t.design.frameColorToggle}
            on={design.frameColor !== ""}
            onToggle={(on) => onChange((d) => ({ ...d, frameColor: on ? d.fg : "" }))}
          >
            <ColorInput
              t={t}
              label={t.design.frameColor}
              value={design.frameColor || design.fg}
              onChange={(c) => onChange((d) => ({ ...d, frameColor: c }))}
            />
          </OwnColors>
        </>
      )}
    </div>
  );
}

/** A switch that reveals color inputs; off means "same as the code color". */
function OwnColors({
  label,
  on,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-accent" />
        {label}
      </label>
      {on && <div className="flex flex-wrap gap-6">{children}</div>}
    </div>
  );
}

function Select<V extends string>({
  label,
  values,
  value,
  name,
  disabled,
  onPick,
}: {
  label: string;
  values: readonly V[];
  value: V;
  name: (v: V) => string;
  disabled?: (v: V) => boolean;
  onPick: (v: V) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onPick(e.target.value as V)}
        className="min-h-11 rounded-md border border-control bg-surface px-3"
      >
        {values.map((v) => (
          <option key={v} value={v} disabled={disabled?.(v)}>
            {name(v)}
          </option>
        ))}
      </select>
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
  disabled,
  onPick,
}: {
  legend: string;
  name: string;
  values: readonly V[];
  value: V;
  label: (v: V) => string;
  thumb: (v: V) => ReactNode;
  /** Options that cannot be combined with the current choice elsewhere. */
  disabled?: (v: V) => boolean;
  onPick: (v: V) => void;
}) {
  const group = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 min-[25rem]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-7">
        {values.map((v) => (
          <label
            key={v}
            className="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-1 py-2.5 text-center text-xs font-medium text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-disabled:cursor-not-allowed has-disabled:opacity-40 has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={`${group}-${name}`}
              value={v}
              checked={value === v}
              disabled={disabled?.(v)}
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
      else if (shape === "hbars") cells.push(<rect key={key} x={x} y={y + 0.12} width={1} height={0.76} rx={0.38} />);
      else if (shape === "small") cells.push(<rect key={key} x={x + 0.12} y={y + 0.12} width={0.76} height={0.76} />);
      else if (shape === "diamond") cells.push(<path key={key} d={`M${x + 0.5} ${y}l0.5 0.5-0.5 0.5-0.5-0.5Z`} />);
      else cells.push(<rect key={key} x={x} y={y} width={1} height={1} />);
    }),
  );
  return (
    <svg viewBox="-0.5 -0.5 5 5" className={THUMB} fill="currentColor">
      {cells}
    </svg>
  );
}

/** A square path with per-corner radii (top-left, top-right, bottom-right, bottom-left). */
function box(x: number, y: number, s: number, [a, b, c, d]: readonly number[]): string {
  return (
    `M${x + a} ${y}H${x + s - b}` +
    (b ? `A${b} ${b} 0 0 1 ${x + s} ${y + b}` : "") +
    `V${y + s - c}` +
    (c ? `A${c} ${c} 0 0 1 ${x + s - c} ${y + s}` : "") +
    `H${x + d}` +
    (d ? `A${d} ${d} 0 0 1 ${x} ${y + s - d}` : "") +
    `V${y + a}` +
    (a ? `A${a} ${a} 0 0 1 ${x + a} ${y}` : "") +
    "Z"
  );
}

// The API's radii (backend internal/qr/geometry.go), as drawn for the top-left eye.
const RING: Record<QrEyeFrame, [number[], number[]]> = {
  square: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  rounded: [
    [2, 2, 2, 2],
    [1.2, 1.2, 1.2, 1.2],
  ],
  "extra-rounded": [
    [2.9, 2.9, 2.9, 2.9],
    [2, 2, 2, 2],
  ],
  circle: [
    [3.5, 3.5, 3.5, 3.5],
    [2.5, 2.5, 2.5, 2.5],
  ],
  leaf: [
    [3, 0, 3, 0],
    [2, 0, 2, 0],
  ],
  pointed: [
    [3, 3, 0, 3],
    [2, 2, 0, 2],
  ],
};
const BALL: Record<Exclude<QrEyeBall, "diamond">, number[]> = {
  square: [0, 0, 0, 0],
  rounded: [0.9, 0.9, 0.9, 0.9],
  circle: [1.5, 1.5, 1.5, 1.5],
  leaf: [1.3, 0, 1.3, 0],
  pointed: [1.3, 1.3, 0, 1.3],
};

function EyeFrameThumb({ shape }: { shape: QrEyeFrame }) {
  const [ring, hole] = RING[shape];
  return (
    <svg viewBox="-0.5 -0.5 8 8" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={box(0, 0, 7, ring) + box(1, 1, 5, hole)} />
      <rect x="2" y="2" width="3" height="3" opacity="0.3" />
    </svg>
  );
}

function EyeBallThumb({ shape }: { shape: QrEyeBall }) {
  return (
    <svg viewBox="-0.5 -0.5 8 8" className={THUMB} fill="currentColor" fillRule="evenodd">
      <path d={box(0, 0, 7, [0, 0, 0, 0]) + box(1, 1, 5, [0, 0, 0, 0])} opacity="0.3" />
      {shape === "diamond" ? <path d="M3.5 1.55L5.45 3.5 3.5 5.45 1.55 3.5Z" /> : <path d={box(2, 2, 3, BALL[shape])} />}
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
