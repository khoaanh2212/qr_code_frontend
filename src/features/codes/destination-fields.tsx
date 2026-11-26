"use client";

import { useId, type Ref } from "react";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import type { Messages } from "@/i18n/messages";
import { SOCIAL_NETWORKS, SOCIAL_TEXT_MAX, socialProblem, socialUrl } from "@/lib/qr/social";
import { normalizeUrlInput } from "@/lib/qr/validate";
import type { DestinationField, DestinationKind, DestinationState } from "./destination";

/**
 * Where a code leads: a website address, or a social network and a username (WhatsApp: a phone
 * number and an optional opening message). Shows the link a valid preset builds.
 */
export function DestinationFields({
  t,
  generator,
  value,
  onChange,
  error,
  urlRef,
  usernameRef,
  textRef,
  readOnly = false,
  hideKind = false,
}: {
  t: Messages["codes"];
  generator: Messages["generator"];
  value: DestinationState;
  onChange: (update: (d: DestinationState) => DestinationState) => void;
  error?: { field?: string; message: string } | null;
  urlRef?: Ref<HTMLInputElement>;
  usernameRef?: Ref<HTMLInputElement>;
  textRef?: Ref<HTMLTextAreaElement>;
  /** While a save is under way: nothing can change under it. */
  readOnly?: boolean;
  /** The kind is chosen elsewhere (the new-code form's grid of what a code opens). */
  hideKind?: boolean;
}) {
  const s = generator.social;
  const ids = { text: useId(), textHelp: useId(), textError: useId() };
  const errorAt = (field: DestinationField) => (error?.field === field ? error.message : undefined);
  const { link } = value;
  const whatsapp = link.network === "whatsapp";
  const textError = errorAt("social.text");
  // Only the profile part: a long opening message would push the line off the screen.
  const profile = { ...link, text: "" };
  const leadsTo = socialProblem(profile) === null ? socialUrl(profile) : null;
  const setLink = (patch: Partial<DestinationState["link"]>) => onChange((d) => ({ ...d, link: { ...d.link, ...patch } }));

  return (
    // `disabled` while saving covers the kind, the network and the fields alike (the reply would
    // otherwise overwrite a change made meanwhile).
    <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
      {!hideKind && (
        <SegmentedControl<DestinationKind>
          legend={s.kind}
          value={value.kind}
          options={[
            { value: "url", label: s.kindUrl },
            { value: "social", label: s.kindSocial },
          ]}
          onChange={(kind) => onChange((d) => ({ ...d, kind }))}
        />
      )}
      {value.kind === "url" ? (
        <TextField
          ref={urlRef}
          label={t.target}
          help={t.targetHelp}
          required
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          maxLength={2048}
          readOnly={readOnly}
          value={value.url}
          error={errorAt("target_url")}
          onChange={(e) => {
            const url = e.target.value;
            onChange((d) => ({ ...d, url }));
          }}
          onBlur={() => onChange((d) => ({ ...d, url: normalizeUrlInput(d.url) }))}
        />
      ) : (
        <>
          <Select
            stacked
            label={generator.fields.social.network.label}
            value={link.network}
            options={SOCIAL_NETWORKS.map((n) => ({ value: n, label: generator.options[n] }))}
            onChange={(network) => setLink({ network })}
          />
          <TextField
            ref={usernameRef}
            label={whatsapp ? s.phone : generator.fields.social.username.label}
            help={s.usernameHelp[link.network]}
            required
            type={whatsapp ? "tel" : "text"}
            inputMode={whatsapp ? "tel" : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            readOnly={readOnly}
            value={link.username}
            error={errorAt("social.username")}
            onChange={(e) => setLink({ username: e.target.value })}
          />
          {whatsapp && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.text} className="text-sm font-medium">
                {generator.fields.social.text.label}
              </label>
              <textarea
                ref={textRef}
                id={ids.text}
                rows={3}
                maxLength={SOCIAL_TEXT_MAX * 2}
                readOnly={readOnly}
                value={link.text}
                aria-invalid={textError ? true : undefined}
                aria-describedby={textError ? ids.textError : ids.textHelp}
                onChange={(e) => setLink({ text: e.target.value })}
                className="w-full rounded-md border border-control bg-surface px-3 py-2 text-base aria-[invalid=true]:border-danger"
              />
              {textError ? (
                <p id={ids.textError} role="alert" className="text-xs font-medium text-danger">
                  {textError}
                </p>
              ) : (
                <p id={ids.textHelp} className="text-xs text-muted">
                  {generator.fields.social.text.help}
                </p>
              )}
            </div>
          )}
          {leadsTo && (
            <p className="text-xs break-all text-muted">
              {s.leadsTo}: <span className="font-mono text-foreground">{leadsTo}</span>
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
