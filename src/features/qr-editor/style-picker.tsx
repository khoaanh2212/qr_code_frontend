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
  RESTAURANT_FRAMES,
  mapTriple,
  type EyeTriple,
  type QrDesign,
  type QrEyeBall,
  type QrEyeFrame,
  type QrFrame,
} from "@/lib/qr/types";
import { ColorInput } from "./color-input";
import { EyeBallThumb, EyeFrameThumb, FrameThumb, ModuleThumb } from "./style-thumbs";

type T = Messages["generator"];

/** The part of a design the picker edits. */
export type StyleDesign = Pick<
  QrDesign,
  "fg" | "module" | "eyeFrames" | "eyeBalls" | "eyeColor" | "eyeBallColor" | "frame" | "frameText" | "frameColor" | "margin"
>;

const EYE_KEYS = ["tl", "tr", "bl"] as const;

function setAt<V>(t: EyeTriple<V>, i: number, v: V): EyeTriple<V> {
  return mapTriple(t, (old, j) => (j === i ? v : old));
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

      {(
        [
          [t.design.frame, "frame", FRAMES.filter((f) => !(RESTAURANT_FRAMES as readonly string[]).includes(f))],
          [t.design.restaurantFrames, "frame-restaurant", RESTAURANT_FRAMES],
        ] as const
      ).map(([legend, name, values]) => (
        <Choices
          key={name}
          legend={legend}
          name={name}
          values={values as readonly QrFrame[]}
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
      ))}
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
        className="rounded-md border border-control bg-surface"
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
