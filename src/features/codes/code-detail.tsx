"use client";

import { Copy, Download, Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Section, SavedNote } from "@/features/account/section";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin, usePersonalWorkspace } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { saveBlob } from "@/lib/browser/download";
import { FORMATS, type QrFormat } from "@/lib/qr/types";
import { normalizeUrlInput } from "@/lib/qr/validate";
import { codeImage, deleteCode, getCode, updateCode } from "./api";
import { designFromLook, lookFromDesign, lookScannable, type CodeLook } from "./design";
import { LookFields } from "./look-fields";
import { NAME_MAX } from "./code-form";
import { codeFailure, type CodeField } from "./errors";

import { StatusBadge } from "./status-badge";
import { ScansSection } from "./code-scans";
import { SlugEditor } from "./slug-editor";
import { FolderSection } from "./folder-section";

type T = Messages["codes"];
type Props = {
  t: T;
  generator: Messages["generator"];
  templates: Messages["templates"];
  auth: AuthMessages;
  locale: Locale;
};

type Load = { kind: "loading" } | { kind: "missing" } | { kind: "error" } | { kind: "ready"; code: DynamicCode };

/** One dynamic code: its image and short link, destination, status, scans, and deletion. */
export function CodeDetail({ t, generator, templates, auth, locale }: Props) {
  const { id } = useParams<{ id: string }>();
  const workspace = usePersonalWorkspace();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController();
    getCode(workspace.id, id, abort.signal)
      .then((code) => setLoad({ kind: "ready", code }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setLoad({ kind: err instanceof ApiError && err.status === 404 ? "missing" : "error" });
      });
    return () => abort.abort();
  }, [workspace, id, attempt]);

  // Every account has a personal workspace; without one there is nothing to load.
  const back = <TextLink href={localizePath(locale, "/app")}>← {t.back}</TextLink>;
  if (!workspace || load.kind === "missing" || load.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-4">
        {back}
        <FormAlert message={load.kind === "missing" ? t.notFound : t.loadFailed} />
        {load.kind === "error" && (
          <Button
            variant="secondary"
            onClick={() => {
              setLoad({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </Button>
        )}
      </div>
    );
  }

  if (load.kind === "loading") {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <p role="status" className="text-sm text-muted">
          {t.title}…
        </p>
      </div>
    );
  }
  const code = load.code;
  const setCode = (c: DynamicCode) => setLoad({ kind: "ready", code: c });
  const ws = workspace.id;
  return (
    <div className="flex flex-col gap-6">
      {back}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="min-w-0 text-2xl font-semibold break-words">{code.name || t.untitled}</h1>
        <StatusBadge status={code.status} t={t} />
      </header>
      <CodeCard t={t} auth={auth} ws={ws} code={code} onSaved={setCode} />
      <div>
        <DestinationSection t={t} auth={auth} ws={ws} code={code} onSaved={setCode} />
        <DesignSection t={t} generator={generator} templates={templates} auth={auth} ws={ws} code={code} onSaved={setCode} />
        <StatusSection t={t} auth={auth} ws={ws} code={code} onSaved={setCode} />
        <FolderSection t={t} locale={locale} ws={ws} code={code} canEdit={workspace.role !== "viewer"} onSaved={setCode} />
        <ScansSection t={t} locale={locale} ws={ws} code={code} />
        <DeleteSection t={t} auth={auth} ws={ws} code={code} locale={locale} />
      </div>
    </div>
  );
}

/** The printable code (it holds the short link), the link itself, and downloads. */
function CodeCard({ t, auth, ws, code, onSaved }: EditProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const editorOpen = editing && code.status !== "locked"; // a lock closes the editor
  const returnFocus = useRef(false);

  // Back from the editor (saved or cancelled): the control that opened it takes focus again.
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  // The "link updated" note goes away like the "copied" one.
  useEffect(() => {
    if (!linkSaved) return;
    const id = setTimeout(() => setLinkSaved(false), 2000);
    return () => clearTimeout(id);
  }, [linkSaved]);

  // The image follows the design and the short link it encodes: a saved change draws it again.
  const designKey = JSON.stringify(code.design) + code.short_url;
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    codeImage(ws, code.id, "png", 512)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
        setImageFailed(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setImageFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ws, code.id, designKey]);

  async function download(fmt: QrFormat) {
    setDownloadError(undefined);
    try {
      saveBlob(await codeImage(ws, code.id, fmt), `proofqr-${code.short_code}.${fmt}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setDownloadError(t.errors.generic);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center">
      <div className="size-40 shrink-0 self-center rounded-md border border-border bg-white p-1 sm:self-auto">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, nothing to optimize */}
        {src && <img src={src} alt="" width={152} height={152} className="size-full" />}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted">{t.shortLink}</span>
          <span className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-base break-all">{code.short_url}</code>
            <Button
              variant="secondary"
              onClick={async () => {
                setLinkSaved(false);
                try {
                  await navigator.clipboard.writeText(code.short_url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // Clipboard refused: the link stays visible to copy by hand.
                }
              }}
            >
              <Copy aria-hidden="true" className="size-4" />
              {t.copy}
            </Button>
            {code.status !== "locked" && !editorOpen && (
              <Button
                ref={editRef}
                variant="secondary"
                onClick={() => {
                  setLinkSaved(false);
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden="true" className="size-4" />
                {t.editLink}
              </Button>
            )}
          </span>
          <SavedNote message={copied ? t.copied : linkSaved ? t.linkSaved : undefined} />
          {editorOpen && (
            <SlugEditor
              t={t}
              auth={auth}
              ws={ws}
              code={code}
              onSaved={onSaved}
              onClose={(saved) => {
                returnFocus.current = true;
                setLinkSaved(saved === true);
                setEditing(false);
              }}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((fmt) => (
            <Button key={fmt} variant="secondary" onClick={() => void download(fmt)}>
              <Download aria-hidden="true" className="size-4" />
              {t.download} {fmt.toUpperCase()}
            </Button>
          ))}
        </div>
        <FormAlert message={downloadError ?? (imageFailed ? t.errors.generic : undefined)} />
      </div>
    </div>
  );
}

type EditProps = { t: T; auth: AuthMessages; ws: string; code: DynamicCode; onSaved: (c: DynamicCode) => void };

function DestinationSection({ t, auth, ws, code, onSaved }: EditProps) {
  const [name, setName] = useState(code.name);
  const [target, setTarget] = useState(code.target_url);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const locked = code.status === "locked";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    const url = normalizeUrlInput(target);
    if (url !== target) setTarget(url);
    if (!/^https?:\/\//i.test(url)) {
      setError({ field: "target_url", message: t.errors.targetUrl });
      targetRef.current?.focus();
      return;
    }
    const changes = {
      ...(name.trim() !== code.name ? { name: name.trim() } : {}),
      ...(url !== code.target_url ? { target_url: url } : {}),
    };
    setSaved(false);
    setError(null);
    if (Object.keys(changes).length === 0) {
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      const updated = await updateCode(ws, code.id, changes);
      onSaved(updated);
      setName(updated.name);
      setTarget(updated.target_url);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = codeFailure(err, t, auth);
      setError(failure);
      if (failure.field === "target_url") targetRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.destinationTitle} description={t.destinationIntro}>
      <form noValidate onSubmit={submit}>
        <fieldset disabled={locked} className="flex flex-col gap-4">
          <TextField
            ref={targetRef}
            label={t.target}
            help={t.targetHelp}
            required
            type="url"
            inputMode="url"
            spellCheck={false}
            maxLength={2048}
            readOnly={busy}
            value={target}
            error={error?.field === "target_url" ? error.message : undefined}
            onChange={(e) => {
              setTarget(e.target.value);
              setSaved(false);
            }}
            onBlur={() => setTarget((v) => normalizeUrlInput(v))}
          />
          <TextField
            label={t.name}
            help={t.nameHelp}
            maxLength={NAME_MAX}
            autoComplete="off"
            readOnly={busy}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
          <FormAlert message={error && error.field !== "target_url" ? error.message : undefined} />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="secondary" busy={busy}>
              {t.save}
            </Button>
            <SavedNote message={saved ? t.saved : undefined} />
          </div>
        </fieldset>
      </form>
    </Section>
  );
}

function DesignSection({
  t,
  generator,
  templates,
  auth,
  ws,
  code,
  onSaved,
}: EditProps & { generator: Messages["generator"]; templates: Messages["templates"] }) {
  const [look, setLook] = useState<CodeLook>(() => lookFromDesign(code.design));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const locked = code.status === "locked";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    setSaved(false);
    if (!lookScannable(look)) {
      setError({ field: "colors", message: t.errors.colors });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateCode(ws, code.id, { design: designFromLook(look, code.design) }));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(codeFailure(err, t, auth));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.designTitle} description={t.designIntro}>
      <form noValidate onSubmit={submit}>
        <fieldset disabled={locked} className="flex flex-col gap-4">
          <LookFields
            t={t}
            generator={generator}
            look={look}
            onChange={(update) => {
              setLook(update);
              setSaved(false);
              setError(null); // a field message describes the old value
            }}
            error={error}
            templates={{ t: templates, workspaceId: ws }}
          />
          <FormAlert message={error && !error.field ? error.message : undefined} />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="secondary" busy={busy}>
              {t.save}
            </Button>
            <SavedNote message={saved ? t.saved : undefined} />
          </div>
        </fieldset>
      </form>
    </Section>
  );
}

function StatusSection({ t, auth, ws, code, onSaved }: EditProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const intro = { active: t.activeIntro, paused: t.pausedIntro, locked: t.lockedIntro }[code.status];

  async function toggle() {
    if (busy || code.status === "locked") return;
    setBusy(true);
    setError(undefined);
    try {
      onSaved(await updateCode(ws, code.id, { status: code.status === "active" ? "paused" : "active" }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(codeFailure(err, t, auth).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.statusTitle}>
      <div className="flex flex-col items-start gap-3">
        <StatusBadge status={code.status} t={t} />
        <p className="text-sm text-pretty text-muted">{intro}</p>
        {code.status !== "locked" && (
          <Button variant="secondary" busy={busy} onClick={() => void toggle()}>
            {code.status === "active" ? t.pause : t.resume}
          </Button>
        )}
        <FormAlert message={error} />
      </div>
    </Section>
  );
}

function DeleteSection({ t, auth, ws, code, locale }: { t: T; auth: AuthMessages; ws: string; code: DynamicCode; locale: Locale }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus(); // the safe choice first
  }, [confirming]);

  if (code.status === "locked") return null;

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteCode(ws, code.id);
      router.push(localizePath(locale, "/app"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(codeFailure(err, t, auth).message);
      setBusy(false);
    }
  }

  return (
    <Section title={t.deleteTitle} description={t.deleteIntro} danger>
      {confirming ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" busy={busy} onClick={() => void remove()}>
            {t.deleteConfirm}
          </Button>
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => {
              setConfirming(false);
              setTimeout(() => startRef.current?.focus());
            }}
          >
            {t.cancel}
          </Button>
        </div>
      ) : (
        <Button ref={startRef} variant="secondary" className="w-fit" onClick={() => setConfirming(true)}>
          {t.deleteStart}
        </Button>
      )}
      <FormAlert message={error} />
    </Section>
  );
}
