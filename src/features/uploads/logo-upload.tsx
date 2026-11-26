"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { Upload } from "@/lib/api/types";
import { config } from "@/lib/config";
import { LogoError, readLogo, toBase64 } from "@/lib/qr/logo";
import type { QrLogo } from "@/lib/qr/types";
import { deleteUpload, getUpload, uploadFile } from "./api";

type T = Messages["uploads"];

/** A design's uploaded logo: its id (what is saved) and its pixels (previews only). */
export interface LogoValue {
  logoUploadId: string;
  logo?: QrLogo;
}

/** The renderer's limits for a logo (the API checks them again when the design is saved). */
const LOGO_MIN_SIDE = 16;
const LOGO_MAX_SIDE = 1024;

type Problem = keyof T["errors"];

function problemOf(err: unknown): Problem {
  if (err instanceof LogoError) return err.reason === "size" ? "size" : "type";
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

/** Only links on the files host are shown or read (the API gives them; this is a second check). */
export function isFilesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.origin === config.filesBaseUrl;
  } catch {
    return false;
  }
}

class NotFilesHost extends Error {}

/** The stored (checked, re-encoded) pixels of an upload, from the files host, without credentials. */
async function pixelsOf(upload: Upload, signal?: AbortSignal): Promise<QrLogo> {
  if (!isFilesUrl(upload.url)) throw new NotFilesHost(upload.url);
  const res = await fetch(upload.url, { credentials: "omit", signal });
  if (!res.ok) throw new Error(`logo ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { name: upload.id, base64: toBase64(bytes), id: upload.id };
}

const fits = (u: Upload) =>
  Boolean(u.width && u.height) &&
  u.width! >= LOGO_MIN_SIDE && u.height! >= LOGO_MIN_SIDE && u.width! <= LOGO_MAX_SIDE && u.height! <= LOGO_MAX_SIDE;

/**
 * Uploads an image to the workspace as a code's or template's logo (backend item 22b). The file
 * is checked here by its bytes first, then by the API, which stores a re-encoded image (an SVG
 * becomes pixels); the preview uses those stored pixels, so it shows what the code will. An
 * upload the logo cannot use (its size in pixels) is deleted again, so it takes no storage.
 */
export function LogoUpload({
  t,
  workspaceId,
  value,
  onChange,
  disabled = false,
}: {
  t: T;
  workspaceId: string;
  value: LogoValue;
  onChange: (next: LogoValue) => void;
  disabled?: boolean;
}) {
  const ids = { input: useId(), help: useId(), error: useId() };
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [announce, setAnnounce] = useState("");
  const [thumb, setThumb] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Uploads in flight stop with the component.
  const uploading = useRef<AbortController | null>(null);
  useEffect(() => () => uploading.current?.abort(), []);

  // Adding or removing the logo swaps the control under focus: focus what replaced it.
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const { logoUploadId, logo } = value;
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (logoUploadId ? removeRef.current : inputRef.current)?.focus();
  }, [logoUploadId]);

  // A saved (or newly applied) design names its logo by id: load its link and pixels whenever
  // the pixels are missing.
  const hasLogo = Boolean(logo);
  useEffect(() => {
    if (!logoUploadId || hasLogo) return;
    const abort = new AbortController();
    getUpload(workspaceId, logoUploadId, abort.signal)
      .then(async (u) => {
        const pixels = await pixelsOf(u, abort.signal);
        setThumb(u.url);
        onChangeRef.current({ logoUploadId, logo: pixels });
      })
      .catch(() => {
        // The design keeps its id (the API draws the code without a file that is gone); say so.
        if (!abort.signal.aborted) setProblem("missing");
      });
    return () => abort.abort();
  }, [workspaceId, logoUploadId, hasLogo]);

  async function choose(file: File) {
    uploading.current?.abort();
    const abort = new AbortController();
    uploading.current = abort;
    setProblem(null);
    setAnnounce(t.uploading);
    setBusy(true);
    let stored: Upload | null = null;
    try {
      await readLogo(file); // the cheap checks, before any upload
      stored = await uploadFile(workspaceId, file);
      if (abort.signal.aborted) return;
      if (!fits(stored)) throw new RangeError("dimensions");
      const pixels = await pixelsOf(stored, abort.signal);
      if (abort.signal.aborted) return;
      setThumb(stored.url);
      setAnnounce(t.uploaded);
      moveFocus.current = true;
      onChangeRef.current({ logoUploadId: stored.id, logo: pixels });
    } catch (err) {
      // A file the logo cannot use takes no storage.
      if (stored) void deleteUpload(workspaceId, stored.id).catch(() => {});
      if (abort.signal.aborted) return;
      setAnnounce("");
      setProblem(err instanceof RangeError ? "dimensions" : problemOf(err));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  const describedBy = [ids.help, problem && ids.error].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{t.title}</span>
      {logoUploadId ? (
        <div className="flex flex-wrap items-center gap-3">
          {thumb && isFilesUrl(thumb) && (
            // A file on our files host; next/image does not optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-12 rounded-sm border border-border bg-white object-contain p-1" />
          )}
          <button
            ref={removeRef}
            type="button"
            disabled={disabled}
            onClick={() => {
              setThumb(null);
              setProblem(null);
              setAnnounce("");
              moveFocus.current = true;
              onChangeRef.current({ logoUploadId: "", logo: undefined });
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-control px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
          >
            <X aria-hidden="true" className="size-4" />
            {t.remove}
          </button>
        </div>
      ) : (
        <label
          htmlFor={ids.input}
          className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
        >
          <ImagePlus aria-hidden="true" className="size-4" />
          {busy ? t.uploading : t.choose}
          <input
            ref={inputRef}
            id={ids.input}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/svg+xml"
            className="sr-only"
            aria-describedby={describedBy}
            aria-invalid={problem ? true : undefined}
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void choose(file);
            }}
          />
        </label>
      )}
      <p id={ids.help} className="text-xs text-muted">
        {t.help}
      </p>
      {problem && (
        <p id={ids.error} role="alert" className="text-xs font-medium text-danger">
          {t.errors[problem]}
        </p>
      )}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
