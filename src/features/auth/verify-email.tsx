"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { localizePath, type Locale } from "@/i18n/config";
import { ApiError, sessionApi } from "@/lib/api";
import type { CaptchaConfig } from "./captcha";
import { ButtonLink, Notice } from "./form-bits";
import { authFailure, type AuthMessages } from "./form-rules";
import { useFragmentToken } from "./fragment-token";
import { ResendForm } from "./resend-form";

type Outcome = { kind: "verifying" } | { kind: "verified" } | { kind: "invalid" } | { kind: "error"; message: string };

/** Confirms the address with the token from the email link, once, as soon as the page opens. */
export function VerifyEmail({ t, locale, captcha }: { t: AuthMessages; locale: Locale; captcha: CaptchaConfig }) {
  const link = useFragmentToken();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "verifying" });
  const [attempt, setAttempt] = useState(0);
  const sent = useRef(-1);

  useEffect(() => {
    if (link.kind !== "present" || sent.current === attempt) return;
    sent.current = attempt; // single-use token: never post it twice for one attempt
    sessionApi
      .requestVoid("/v1/auth/verify-email", { method: "POST", body: { token: link.token } })
      .then(() => setOutcome({ kind: "verified" }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === "invalid_token") setOutcome({ kind: "invalid" });
        else setOutcome({ kind: "error", message: authFailure(err, t).message });
      });
  }, [link, attempt, t]);

  if (link.kind === "reading") return null;
  if (link.kind === "missing") {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="warning">
          <p>{t.tokenMissing}</p>
        </Notice>
        <ResendForm t={t} locale={locale} captcha={captcha} />
      </div>
    );
  }

  switch (outcome.kind) {
    case "verifying":
      return (
        <Notice>
          <p className="text-muted">{t.verifying}</p>
        </Notice>
      );
    case "verified":
      return (
        <div className="flex flex-col gap-6">
          <Notice tone="success">
            <p>{t.verified}</p>
          </Notice>
          <ButtonLink href={localizePath(locale, "/app")}>{t.toApp}</ButtonLink>
        </div>
      );
    case "invalid":
      return (
        <div className="flex flex-col gap-6">
          <Notice tone="warning">
            <p>{t.verifyInvalid}</p>
          </Notice>
          <ResendForm t={t} locale={locale} captcha={captcha} />
        </div>
      );
    case "error":
      return (
        <Notice tone="danger">
          <p className="font-medium">{outcome.message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setOutcome({ kind: "verifying" });
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </Button>
        </Notice>
      );
  }
}
