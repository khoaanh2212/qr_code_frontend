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
| Paths (any language prefix) | `/`, per-type pages, pricing, legal | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/app/...` |
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
5. Deployment (with backend work item 11). The production Docker image is ready ("Docker"
   above) and runs locally next to the API with the backend's `make up-web`; where it runs in
   production is still open.
