# QR Code Generator – Frontend

Customer web app for the QR code generator, built with Next.js 16 (App Router, Cache Components),
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

## Site structure

Public pages and the logged-in app are two root layouts in one repository and one domain:

| | `src/app/(marketing)` | `src/app/(private)` |
|---|---|---|
| Paths | `/`, per-type pages, pricing, legal | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/app/...` |
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
    (marketing)/       public pages, root layout
    (private)/         root layout rendered per request (nonce)
      (auth)/          login, register, password reset, email verification
      app/             /app/... – the logged-in app
    global-not-found.tsx
    robots.ts, sitemap.ts
  proxy.ts             CSP per surface, noindex and no-store for private pages
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

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time: never put secrets there.

## Roadmap

1. Generator on the home page (`features/qr-editor`): type forms built from `GET /v1/qr/types`,
   preview through `GET /v1/qr/render`, download PNG/SVG through `POST /v1/qr/render`.
2. Auth pages: sign-up (Turnstile), login with `return_to`, email verification and password reset
   (tokens read from the URL fragment), logout.
3. Account pages under `/app`: profile, password change, devices, account deletion.
4. Per-type public pages (`/wifi-qr-code`, ...) for SEO.
5. Deployment (with backend work item 11).
