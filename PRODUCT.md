# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small businesses and independent workers worldwide: cafés and restaurants, shops, freelancers and
small offices. They need a QR code for something physical: a menu, the guest Wi-Fi, a business card,
a flyer, a shop window, a table tent. Many work from a phone, often in the middle of other work, and
want the code printed or shared within minutes. English is the primary language; Vietnamese,
Spanish, German, French and Portuguese are offered from the start for reach.

Later audiences (when dynamic codes and paid plans ship): the same businesses managing codes they
have already printed, and small teams that share them.

## Product Purpose

Create a working QR code in seconds without an account, and download it ready to print (PNG or
SVG). Later: dynamic codes whose destination can change after printing, scan analytics, hosted
landing pages (menu, PDF, business page, links) and paid plans.

Success: a visitor gets a correct, scannable code on the first try, trusts that it will keep
working, and comes back when they need the next one.

## Positioning

An honest QR code generator. The established products in this category are criticised for turning
codes people already printed into redirects through their own domain and switching them off when a
trial ends. This product commits to the opposite, and says so:

- A static code is plain content, free and the user's forever; it never passes through our servers.
- A dynamic code is labelled as dynamic, with its short link shown, before it is created; a code is
  never switched off abruptly when a plan ends (warning and grace period first).
- Privacy: static code content is never stored or logged; no third-party trackers in the app; no
  raw IP addresses stored.
- Fast and simple: no account, no ads, no pop-ups between the visitor and the download.
- Paid plans are meant to be clearly cheaper than the established products (prices not set yet).

## Operating Context

- The code ends up on paper, packaging, signage or a screen; it is scanned by phones in shops,
  restaurants and on the street, often in poor light. Scannability (contrast, quiet zone, error
  correction with a logo) matters more than decoration.
- Typical session: choose a type, type the content, glance at the preview, adjust colors or add a
  logo, download, print or send to a designer.
- Public pages (generator, per-type pages, pricing) are found through search; the logged-in app
  lives under `/app`; the admin console is a separate product for operators.

## Capabilities and Constraints

- Static QR types: website, text, Wi-Fi, contact (vCard), email, SMS, phone. Options: colors (dark
  on light, contrast ≥ 3:1), error correction, margin, PNG/JPEG logo (forces error correction H),
  PNG or SVG output up to 2048 px.
- Accounts: email + password sign-up with email verification; Google login planned.
- Roadmap (backend `docs/PLAN.md`): dynamic codes and scan analytics, hosted landing pages,
  workspaces and teams, paid plans, API keys, custom domains, bulk creation.
- Six languages: en (no URL prefix), vi, es, de, fr, pt. Translations beyond English and Vietnamese
  still need a native speaker's review.
- Rendering and all rules live in the Go API; this app never generates codes itself.
- Open decisions: product name, logo and domain ("QR Code Generator" is a placeholder); pricing.

## Brand Commitments

- No final name, logo or domain yet. Future work must not invent a name, logo, mascot or slogan;
  keep the placeholder until the owner decides.
- Copy is plain and direct, and says what is true: what the code contains, whether it is static or
  dynamic, what happens when a plan ends.

## Evidence on Hand

None yet: no customers, testimonials, usage numbers, press or case studies. Future work must not
fabricate any of them (no "trusted by …", no user counts, no ratings).

## Product Principles

1. The code works. Never offer a code that cannot be printed or scanned; block it and say why.
2. Honest by default. Static stays static and free; anything dynamic or paid is labelled before it
   is created; nothing printed is ever held hostage.
3. Private by default. Content stays out of URLs, logs and third parties.
4. Seconds, not steps. No account, ad or pop-up stands between a visitor and a free static code.
5. Everyone, everywhere. Six languages, phone-first, accessible to keyboard and screen reader users.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor: keyboard operable, visible focus, 44 px touch targets on phones, text and
control contrast, live regions for status, reduced motion respected. Translated text must fit:
German and Vietnamese labels are long.
