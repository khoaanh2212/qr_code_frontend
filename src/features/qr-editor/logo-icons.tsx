"use client";

import { useId, type ReactNode } from "react";
import type { Messages } from "@/i18n/messages";
import { LOGO_ICONS, type QrLogoIcon } from "@/lib/qr/types";

type T = Messages["generator"];

/** Drawings of the API's built-in icons (backend internal/qr/icons.go), in a 1x1 box. */
const ICONS: Record<QrLogoIcon, ReactNode> = {
  "scan-me": (
    <>
      <path d="M.05 .3V.05H.3M.7 .05H.95V.3M.95 .7V.95H.7M.3 .95H.05V.7" fill="none" stroke="currentColor" strokeWidth=".07" />
      <text x=".5" y=".47" fontSize=".2" fontWeight="700" textAnchor="middle">
        SCAN
      </text>
      <text x=".5" y=".75" fontSize=".24" fontWeight="700" textAnchor="middle">
        ME
      </text>
    </>
  ),
  link: (
    <g fill="none" stroke="currentColor" strokeWidth=".09">
      <circle cx=".37" cy=".63" r=".205" />
      <circle cx=".63" cy=".37" r=".205" />
    </g>
  ),
  wifi: (
    <>
      <circle cx=".5" cy=".8" r=".08" />
      <path d="M.33 .63A.24 .24 0 0 1 .67 .63M.2 .5A.43 .43 0 0 1 .8 .5M.06 .36A.62 .62 0 0 1 .94 .36" fill="none" stroke="currentColor" strokeWidth=".09" />
    </>
  ),
  mail: (
    <>
      <rect x=".085" y=".235" width=".83" height=".53" rx=".06" fill="none" stroke="currentColor" strokeWidth=".07" />
      <path d="M.15 .32L.5 .57L.85 .32" fill="none" stroke="currentColor" strokeWidth=".07" />
    </>
  ),
  location: (
    <path
      fillRule="evenodd"
      d="M.5 .08A.3 .3 0 0 1 .765 .52L.5 .96L.235 .52A.3 .3 0 0 1 .5 .08ZM.5 .26A.12 .12 0 1 0 .5 .5A.12 .12 0 1 0 .5 .26Z"
    />
  ),
  user: (
    <>
      <circle cx=".5" cy=".29" r=".19" />
      <path d="M.14 .92V.88A.36 .36 0 0 1 .86 .88V.92A.03 .03 0 0 1 .83 .94H.17A.03 .03 0 0 1 .14 .92Z" />
    </>
  ),
  star: <path d="M.5 .06L.62 .38L.96 .39L.69 .6L.78 .93L.5 .74L.22 .93L.31 .6L.04 .39L.38 .38Z" />,
  heart: <path d="M.5 .88L.12 .47A.21 .21 0 0 1 .5 .26A.21 .21 0 0 1 .88 .47Z" />,
};

/** Radio cards: no icon, or one of the built-in icons. */
export function LogoIconPicker({
  t,
  value,
  onPick,
}: {
  t: T;
  value: QrLogoIcon | "";
  onPick: (icon: QrLogoIcon | "") => void;
}) {
  const group = useId();
  const options: (QrLogoIcon | "")[] = ["", ...LOGO_ICONS];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{t.design.logoIcon}</legend>
      <div className="grid grid-cols-3 gap-2 min-[25rem]:grid-cols-5 sm:grid-cols-9">
        {options.map((icon) => {
          const label = icon ? t.design.logoIcons[icon] : t.design.logoIconNone;
          return (
            <label
              key={icon || "none"}
              title={label}
              className="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-1 py-2.5 text-center text-xs font-medium text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name={`${group}-icon`}
                checked={value === icon}
                onChange={() => onPick(icon)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-foreground">
                <svg viewBox="-.1 -.1 1.2 1.2" className="size-7" fill="currentColor">
                  {icon ? ICONS[icon] : <path d="M.2 .2L.8 .8M.8 .2L.2 .8" stroke="currentColor" strokeWidth=".06" />}
                </svg>
              </span>
              <span className="w-full truncate">{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
