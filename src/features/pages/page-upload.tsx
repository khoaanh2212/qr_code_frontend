"use client";

import { FileText, ImagePlus, Music, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getUpload, uploadFile } from "@/features/uploads/api";
import { isFilesUrl } from "@/features/uploads/logo-upload";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { Upload } from "@/lib/api/types";

type T = Messages["pages"];
export type UploadKind = "image" | "pdf" | "audio";

/** What each kind accepts, and its size limit (backend PLAN "Rules – uploads"; the API checks again). */
const KINDS: Record<UploadKind, { accept: string; maxBytes: number }> = {
  image: { accept: "image/png,image/jpeg,image/webp", maxBytes: 10 * 1024 * 1024 },
  pdf: { accept: "application/pdf", maxBytes: 20 * 1024 * 1024 },
  audio: { accept: "audio/mpeg,.mp3", maxBytes: 20 * 1024 * 1024 },
};

export function uploadKind(fieldKind: string): UploadKind {
  return fieldKind === "upload_pdf" ? "pdf" : fieldKind === "upload_audio" ? "audio" : "image";
}

type Problem = "type" | "size" | "quota" | "verify" | "busy" | "failed";

function problemOf(err: unknown): Problem {
  if (!(err instanceof ApiError)) return "failed";
  switch (err.code) {
    case "validation_error":
      return "type";
    case "payload_too_large":
      return "size";
    case "storage_quota_exceeded":
      return "quota";
    case "email_not_verified":
      return "verify";
    case "rate_limited":
    case "upload_in_progress":
    case "busy":
      return "busy";
    default:
      return "failed";
  }
}

/** A size as people read it: "2.4 MB", "820 KB". */
function sizeText(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * A page's file (an image, a PDF or an MP3): chosen, checked against its kind's size limit,
 * uploaded to the workspace's files (POST .../uploads, which decides the type from the bytes),
 * and kept as its upload id. An image shows from the files host; a PDF or a sound by kind and size.
 */
export function PageUpload({
  t,
  workspaceId,
  label,
  fieldKind,
  path,
  required,
  value,
  error,
  onChange,
}: {
  t: T;
  workspaceId: string;
  label: string;
  fieldKind: string;
  path: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (id: string) => void;
}) {
  const kind = uploadKind(fieldKind);
  const ids = { input: useId(), help: useId(), error: useId(), label: useId() };
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [known, setKnown] = useState<Upload | null>(null);
  const info = known && known.id === value ? known : null;
  // Each pick or removal starts a new attempt; an answer for an older one (or after the field is
  // gone) is dropped, so a late upload never lands in a field that moved on.
  const attempt = useRef(0);
  useEffect(() => () => void (attempt.current += 1), []);

  // A file chosen before (a draft kept while switching types): read what it is to show it.
  useEffect(() => {
    if (!value || info) return;
    const controller = new AbortController();
    getUpload(workspaceId, value, controller.signal)
      .then(setKnown)
      .catch(() => undefined);
    return () => controller.abort();
  }, [value, info, workspaceId]);

  async function choose(file: File) {
    if (busy) return;
    if (file.size > KINDS[kind].maxBytes) return setProblem("size");
    const mine = ++attempt.current;
    setBusy(true);
    setProblem(null);
    try {
      const upload = await uploadFile(workspaceId, file);
      if (mine !== attempt.current) return;
      setKnown(upload);
      onChange(upload.id);
    } catch (err) {
      if (mine === attempt.current) setProblem(problemOf(err));
    } finally {
      if (mine === attempt.current) setBusy(false);
    }
  }

  const message =
    problem === "type" || problem === "size" ? t.upload.errors[problem][kind] : problem ? t.upload.errors[problem] : error;
  const Icon = kind === "pdf" ? FileText : kind === "audio" ? Music : ImagePlus;
  const thumb = kind === "image" && info && isFilesUrl(info.url) ? info.url : null;
  const action = busy ? t.upload.uploading : value ? t.upload.replace : t.upload.choose[kind];

  return (
    <div role="group" aria-labelledby={ids.label} className="flex flex-col gap-1.5">
      <span id={ids.label} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <span className="inline-flex items-center gap-2 text-sm">
            {thumb ? (
              // A file on the files host; next/image cannot optimize it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" referrerPolicy="no-referrer" className="size-12 rounded-[2px] border border-border object-cover" />
            ) : (
              <Icon aria-hidden="true" className="size-5 text-muted" />
            )}
            {info && (
              <span className="font-mono text-xs tabular-nums text-muted">
                {t.upload.kinds[kind]} · {sizeText(info.size_bytes)}
              </span>
            )}
          </span>
        )}
        {/* Never disabled while uploading (that would drop focus): it ignores picks instead. */}
        <label
          className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
        >
          <Icon aria-hidden="true" className="size-4" />
          <span aria-hidden="true">{action}</span>
          <input
            id={ids.input}
            type="file"
            data-path={path}
            accept={KINDS[kind].accept}
            aria-disabled={busy || undefined}
            aria-required={required || undefined}
            aria-label={`${action}: ${label}`}
            aria-describedby={message ? ids.error : ids.help}
            aria-invalid={message ? true : undefined}
            className="sr-only"
            onClick={(e) => {
              if (busy) e.preventDefault();
            }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void choose(file);
            }}
          />
        </label>
        <span role="status" className="sr-only">
          {busy ? t.upload.uploading : ""}
        </span>
        {value && !busy && (
          <button
            type="button"
            aria-label={`${t.upload.remove}: ${label}`}
            onClick={() => {
              attempt.current += 1;
              setProblem(null);
              onChange("");
              // The button goes with the file: focus moves to the picker beside it.
              document.getElementById(ids.input)?.focus();
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
            {t.upload.remove}
          </button>
        )}
      </div>
      {message ? (
        <p id={ids.error} role="alert" className="text-xs font-medium text-danger">
          {message}
        </p>
      ) : (
        <p id={ids.help} className="text-xs text-muted">
          {t.upload.help[kind]}
        </p>
      )}
    </div>
  );
}
