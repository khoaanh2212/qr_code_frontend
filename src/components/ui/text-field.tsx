"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";

const control =
  "min-h-11 w-full rounded-md border border-control bg-surface px-3 text-base text-foreground placeholder:text-muted aria-[invalid=true]:border-danger";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** React 19: a plain prop, forwarded to the <input> (for focusing the first invalid field). */
  ref?: Ref<HTMLInputElement>;
  label: string;
  help?: string;
  error?: string;
  /** Rendered at the end of the input row (e.g. the show-password toggle). */
  trailing?: ReactNode;
}

/** Label, input, help and error, wired with aria-describedby (DESIGN.md "Inputs / Fields"). */
export function TextField({ label, help, error, required, trailing, className = "", ...input }: FieldProps) {
  const id = useId();
  // The error replaces the help while it shows, so a screen reader hears the rule once.
  const showHelp = Boolean(help) && !error;
  const describedBy = [showHelp && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${control} ${trailing ? "pr-12" : ""} ${className}`}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
      {showHelp && (
        <p id={`${id}-help`} className="text-xs text-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A password field with a show/hide toggle (no "repeat password" field). The toggle keeps one
 * label ("Show password") and reports its state with aria-pressed, so the state is read once.
 */
export function PasswordField({ showLabel, ...props }: Omit<FieldProps, "type" | "trailing"> & { showLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          aria-label={showLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-foreground/5 hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      }
    />
  );
}
