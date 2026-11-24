"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./icon-button";

export interface CopyButtonProps {
  value: string;
  /** Accessible name and tooltip ("Copy short link"). */
  label: string;
  /** Announced (politely) after a copy. */
  copiedLabel: string;
  /** Announced when the clipboard refuses (permissions, insecure context). */
  failedLabel: string;
}

/** Copies `value`; the icon turns into a check for two seconds and the result is announced. */
export function CopyButton({ value, label, copiedLabel, failedLabel }: CopyButtonProps) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setResult("copied");
    } catch {
      setResult("failed");
    }
    timer.current = setTimeout(() => setResult("idle"), 2000);
  }

  return (
    <>
      <IconButton
        label={label}
        icon={result === "copied" ? Check : Copy}
        onClick={() => void copy()}
        className={result === "copied" ? "text-accent hover:text-accent" : ""}
      />
      <span role="status" className="sr-only">
        {result === "copied" ? copiedLabel : result === "failed" ? failedLabel : ""}
      </span>
    </>
  );
}
