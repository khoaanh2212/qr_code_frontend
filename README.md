# ProofQR – Frontend

Customer web app of ProofQR, the honest QR code generator, built with Next.js 16 (App Router, Cache Components),
React 19, TypeScript and Tailwind CSS 4. It talks to the Go API in `qrcode_generator_backend`.

## Getting started

Requires Node 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local     # API and site origins
pnpm dev                       # http://localhost:3000
```

Run the API locally with `make up` in the backend repository; it serves http://localhost:8080 and
already allows http://localhost:3000 (`CORS_ALLOWED_ORIGINS`).

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm check` | ESLint, TypeScript and unit tests |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm build` / `pnpm start` | Production build and server |

## Languages

English, Tiếng Việt, Español, Deutsch, Français, Português. English lives at the root (`/`,
`/login`); every other language has a prefix (`/vi`, `/vi/login`). Internally every route is under
`src/app/[lang]`: `src/proxy.ts` rewrites unprefixed URLs to `/en/...` and redirects `/en/...` to
the unprefixed URL, so each page has one URL. There is no redirect based on `Accept-Language`:
pages stay cacheable and crawlers see what they asked for; visitors pick a language with the
switcher. Public pages carry `hreflang` alternates (`x-default` = English) and the sitemap lists
every language.

Translations live in `src/i18n/messages/<locale>.ts`. English (`en.ts`) is the reference: the
other files must have exactly its keys (`satisfies Messages`, checked by `tsc`) and the same
`{placeholders}` (checked by a unit test). Server components read them with `getMessages()`;
client components receive the part they need as props.

The global 404 page has no route and so no locale on the server: it renders English and switches
to the language of the URL in the browser, with its few texts in `src/i18n/not-found.ts`.

> The `es`, `de`, `fr` and `pt` texts were written without a native speaker's review. Have them
> reviewed before launch.

To add a language: add it to `LOCALES` and `LOCALE_NAMES` in `src/i18n/config.ts`, add
`src/i18n/messages/<locale>.ts`, and register it in `src/i18n/messages/index.ts`.

## Site structure

Public pages and the logged-in app are two root layouts in one repository and one domain:

| | `src/app/[lang]/(marketing)` | `src/app/[lang]/(private)` |
|---|---|---|
| Paths (any language prefix) | `/`, per-type pages, pricing, legal | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/report`, `/app/...` |
| Rendering | Prerendered, cached at the CDN | Per request |
| Login | Never required | Required under `/app` |
| CSP | `script-src 'self' 'unsafe-inline'` (Next.js inline payload; a nonce cannot live in cached HTML) | `script-src 'nonce-…' 'strict-dynamic'`, fresh per request |
| API client | `publicApi` (no cookies) | `sessionApi` (session cookie) |
| Indexing | Indexed, in the sitemap | `noindex`, disallowed in robots.txt |

Two root layouts are deliberate: navigating between them is always a full page load, so a page
never keeps the other surface's CSP after a client-side navigation.

```
src/
  app/
    [lang]/
      (marketing)/     public pages, root layout, prerendered per language
      (private)/       root layout rendered per request (nonce)
        (auth)/        login, register, password reset, email verification
        app/           /app/... – the logged-in app
    global-not-found.tsx
    robots.ts, sitemap.ts
  proxy.ts             language routing, CSP per surface, noindex and no-store for private pages
  i18n/                locales, message catalogs, hreflang helpers
  features/            one folder per feature (auth, dashboard, qr-editor, ...)
  lib/                 API client, config, security (CSP), navigation (return_to)
  components/          design system and the shared <html> document
  styles/              global CSS (Tailwind)
```

Rules (enforced by ESLint where possible):

- Route files are never imported; shared code lives in `features`, `lib` and `components`, so the
  two surfaces can move to separate deployments (e.g. `app.<domain>`) by moving folders.
- Marketing pages never import `sessionApi` or `src/features/auth` and never render user-supplied
  content: they share an origin with the app, so script running there could call the API as the
  logged-in user. For the same reason, any analytics on marketing pages should be first-party
  and loaded from `'self'`.
- No `dangerouslySetInnerHTML`.
- `return_to` values go through `safeReturnTo` (no open redirects, mirrors the backend rule).

## Security headers

Every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
`Cross-Origin-Opener-Policy: same-origin`. HSTS is set at the edge (Cloudflare). The CSP is built in
`src/lib/security/csp.ts` and set in `src/proxy.ts`.

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Origin of the API. Required for production builds. |
| `NEXT_PUBLIC_SITE_URL` | Public origin of this site (canonical URLs, sitemap). Required for production builds. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (sign-up, resend, forgot password). Required for production builds; empty locally. |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time: never put secrets there.

## Docker

One image serves both the public pages and `/app` (they are one Next.js app with two root layouts;
see "Site structure"). The `Dockerfile` builds the standalone server (`output: "standalone"`) and
runs it on distroless Node 22 as a non-root user, with a healthcheck on `/robots.txt`.

The `NEXT_PUBLIC_*` values are build arguments, so build one image per environment:

```sh
docker build -t proofqr-web \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA .

docker run --rm -p 127.0.0.1:3000:3000 --read-only \
  --tmpfs /app/.next/cache:uid=65532,gid=65532 --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true proofqr-web
```

The root filesystem can be read-only; Next.js only writes its cache to `/app/.next/cache`.
To run it next to the API, use `make up-web` in the backend repository: its compose `web` service
builds this `Dockerfile` with local values.
Where it runs in production (VPS next to the API, or a managed host) is decided with the backend's
deploy item (backend `docs/PLAN.md`, Phase 1 item 11).

## Roadmap

1. ~~Generator on the home page~~ Done (`src/features/qr-editor`): type forms built from
   `GET /v1/qr/types`, live preview (GET for plain content, POST for Wi-Fi, vCard and logos, so
   secrets never land in URLs), contrast check, logo upload, PNG/SVG download.
2. ~~Auth pages~~ Done (`src/features/auth`): sign-up with Turnstile and a check-email screen,
   login with `return_to`, email verification and password reset (tokens read from the URL
   fragment, then removed), forgot password, logout. Emails still link to English pages until the
   backend stores the user's language (backend PLAN, later work).
3. ~~Account pages~~ Done (`src/features/account`, `/app/account`): profile and display name,
   password change, account deletion, logged-in devices. Not in the API yet (backend PLAN):
   email change, personal data export, time zone, usage counters.
4. ~~Per-type public pages~~ Done (`src/features/qr-type-pages`, one route folder per slug, `src/lib/qr/type-pages.ts`):
   `/url-qr-code`, `/text-qr-code`, `/wifi-qr-code`, `/vcard-qr-code`, `/email-qr-code`,
   `/sms-qr-code`, `/phone-qr-code` in every language, each opening the generator on its type.
   Below it, server-rendered text that is specific to the type (the generator renders in the
   browser, so this is what search engines read): how-to steps, two paragraphs of details, four
   questions. Linked from the home page and the footer of every public page with "Wi-Fi QR code"
   style anchors, and listed in the sitemap. Slugs are English in every language and never change
   once published (a rename needs a 308 redirect). Copy rules: claims must match what the API
   does (static content, nothing stored, no scan tracking); check facts in the backend encoders.
   Later, once Search Console has data: localized slugs, a longer home page description,
   structured data (needs a CSP-safe way to emit JSON-LD, since `dangerouslySetInnerHTML` is
   banned).
5. ~~Google login~~ Done (backend items 18-21): "Continue with Google" on login and sign-up
   (`src/features/auth/google.tsx`, a link to the API, shown when `NEXT_PUBLIC_GOOGLE_LOGIN=true`),
   the failed-login message, and login methods on `/app/account/security` (password set or not,
   linked Google, unlink while a password remains, set a password by email). An account without a
   password confirms its deletion with Google (`intent=reauth`, back to
   `/app/account/security?delete=confirm`). Linking Google from the account page is not offered:
   a different Google address would log in to another account.
6. ~~Dynamic codes~~ Done (backend items 35-37, `src/features/codes`): the dashboard at `/app`
   lists the personal workspace's codes; `/app/codes/new` creates one (Turnstile), prefilled when
   the generator's "Make it dynamic" (website type) hands over the destination and colors through
   sessionStorage; `/app/codes/{id}` shows the code image and short link (copy, PNG/SVG download),
   edits destination and name, pauses and resumes, shows 30 days of scans as a bar chart (with a
   table view) plus top countries and devices, and deletes after a confirmation. Locked codes are
   read-only. Team workspaces and custom date ranges come later.
7. ~~QR styles~~ Done (backend item 42, `src/features/qr-editor/style-picker.tsx`): pattern,
   eye shape and frame with a caption, as radio cards with small drawings, in the generator's
   design panel, the new-code form, and a "Design" section on a code's page. Only options that
   differ from the plain look are sent, so plain GET URLs (and their CDN copies) are unchanged.
   Choosing a frame fills in the localized caption and keeps the margin at 2 or more. A caption
   of the user's own is rendered by `POST /v1/me/qr/render` with the session (the only session
   call on a public page, see the ESLint exception); signed out, the caption asks to sign in.
8. ~~Eye parts and colors~~ Done (backend item 45): outer and inner eye shapes (for all eyes or
   each one), own colors for the eyes and the frame, three more patterns. Pairs the API refuses
   are disabled in the picker; stored designs with the old `eye` shorthand load as ring + center.
9. ~~Decorative frames~~ Done (backend item 46): speech bubbles, ribbon, phone, bag, cup, arrow and
   corner brackets in the frame picker, with small drawings of each.
10. ~~Built-in icons, JPG and PDF~~ Done (backend item 47): "Or pick an icon" under the logo upload
    (eight icons, exclusive with an uploaded logo, error correction locked to H), and JPG and PDF
    next to PNG and SVG in the generator and on a code's page.
11. ~~Design templates~~ Done (backend item 48, `src/features/templates`): "Apply a template" and
    "Save as template" in the new-code form, a code's Design section and the generator (the
    generator reads the session only when the templates section is opened; signed out, it offers
    sign-in), plus `/app/templates` with previews, rename and delete. Applying copies the design.
12. ~~Restaurant frames~~ Done (backend item 49): beer, chef's hat, cloche, takeaway cup, menu and
    receipt, as a "Restaurants & cafés" group in the frame picker.
13. ~~Abuse reports~~ Done (backend item 38, `src/features/report`): `/report` takes a short link
    (the whole link or its 8-character code; `?code=` prefills it), a reason and optional details,
    with Turnstile, and sends `POST /v1/reports` without cookies. It promises a review, not an
    outcome (reports never switch a code off). Linked from the public footer and from the short
    link's notice pages.
14. ~~Codes list~~ Done (backend PLAN items 50-52, `src/features/codes/list`): the dashboard lists
    codes with a thumbnail, status, scans, short link (copy), destination and a menu (download
    PNG/SVG, pause/resume, delete). Search (accent-insensitive, pasted links match), status
    filter and order (newest, oldest, name, most scanned) are sent to the API (`q`, `status`,
    `sort`; search after typing pauses), with "Load more" through the API's cursor; the count
    reads "50+" while more pages remain (the API sends no total). List or grid layout,
    remembered in this browser. Bulk pause, resume and delete go through
    `POST .../codes/bulk` in requests of up to 100 codes (one confirmation for deletes); each
    code's result is applied, the codes not changed stay selected, and the bulk limit (3
    requests a minute) is reported with the wait. Reusable parts live in `src/components/ui`
    (see its README).
15. ~~Two-step verification~~ Done (backend PLAN items 29-33). Login step (`src/features/auth/verify-login.tsx`,
    `/login/verify`): after a right password (or the Google callback) on an account with two-step
    verification, the page reads the pending login (`GET /v1/auth/login/mfa`, so it also works
    after the Google redirect and a reload) and offers the methods the account has: authenticator
    app code (first when present), passkey (`@simplewebauthn/browser`) and recovery code, with the
    others under "Other ways to verify". An expired or used-up login sends the person back to log
    in, keeping `return_to`. Settings (`src/features/account/two-step.tsx`, on
    `/app/account/security`): authenticator setup with a QR code drawn by our own API (POST, so the
    secret never lands in a URL) and the key as text, passkeys (add with a name, remove), recovery
    codes shown once (copy, download as text), new codes, and turning it off (each factor is
    removed; the API has no single "off"). Every change asks for the password again (or Google for
    an account without one) when the API's 5-minute step-up has lapsed, then runs again; creating
    a passkey asks for a second click instead, as the browser wants a fresh gesture.
16. ~~Custom short link~~ Done (backend PLAN item 53, `src/features/codes/slug-editor.tsx`): on a
    dynamic code's page, "Edit link" sets the end of the short link (4-40 lowercase letters,
    digits and single hyphens) through `PATCH .../codes/{id}` (`short_code`). The origin is shown
    as a fixed prefix, a generated code opens with an empty field and a custom one is prefilled
    and selected. The page warns that printed codes keep working (old links redirect forever) and
    states the limits (3 changes per code, 50 custom links per workspace), mirrored in
    `slug-rules.ts`; taken, refused and over-limit links get translated errors. Enter saves,
    Escape cancels, and the code image is redrawn after a change.
17. ~~Folders~~ Done (backend PLAN item 54, `src/features/codes/folders`): codes are grouped into
    flat folders (at most 100 per workspace, names of 1-60 characters, limits mirrored in
    `folders/rules.ts`). The dashboard filters by folder through `?folder=` (all codes, "No folder"
    or one folder, each with its code count): a column beside the list from the `lg` breakpoint, a
    select in the toolbar below it. The choice lives in the list's query state like status and
    order, so it is not remembered across page loads; a folder deleted elsewhere (the API answers
    200 with no codes for it, so an empty first page under a folder filter makes the app check the folder
    list) falls back to all codes with a note instead of an error. Editors create, rename and delete folders (inline name
    form with translated errors for a taken name, the limit and an invalid name; deleting asks for a
    confirmation that says the codes are kept) and move codes: "Move to folder…" in a code's menu,
    "Move to folder" in the selection bar (bulk requests of up to 100 codes, per-code results
    reported, codes not moved stay selected) and a folder select on the code's page. Viewers can
    filter but see no folder or move controls. Folder names are rendered as text and long ones are
    cut with the full name in a tooltip.
18. ~~Campaign details~~ Done (backend PLAN item 55, `src/features/codes/campaign`): a "Campaign
    details" section on the code's page, between Status and Folder: start and end date, print run
    and medium (12 print and 5 digital media in a grouped select, or "Other" with a label of up to
    40 characters). They are notes that never change where the code leads. Everyone in the
    workspace reads them; editors of an unlocked code get "Add details" / "Edit details", which
    swaps the list for a form (native date pickers, a numeric text field for the print run, the
    label question only for "Other", "Remove all details" behind a confirmation). The form sends
    the whole campaign (the API replaces it; `null` when every field is empty), nothing when
    nothing changed, and checks the same rules as the server first (`campaign/rules.ts`: dates
    between 2000 and 2100, end not before start, print run 1 to 100,000,000, label without line
    breaks or invisible characters); the API's `campaign.<field>` refusals land on their field. A
    code locked meanwhile is reloaded and the section turns read-only. Dates are calendar days:
    they are formatted in UTC so they never shift with the reader's time zone, and numbers follow
    the locale. The label is rendered as text. `Select` gained option groups (`<optgroup>`) and a
    stacked label for forms.
19. Deployment (with backend work item 11). Planned with it: render the QR type catalog on the
    server so the generator is in the prerendered HTML instead of a skeleton (better LCP and first
    input). It needs a server-side API URL (e.g. `API_INTERNAL_URL=http://api:8080` in compose),
    a fallback to today's browser fetch when the API is unreachable at build or render time
    (without caching the failure), and a cache lifetime for the catalog (how long a new backend
    type may take to appear). Proposed in the 2026-11-24 review, postponed by decision. The production Docker image is ready ("Docker"
   above) and runs locally next to the API with the backend's `make up-web`; where it runs in
   production is still open.
