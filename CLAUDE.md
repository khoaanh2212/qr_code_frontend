@AGENTS.md

# QR Code Generator Frontend

Next.js customer web app for the QR code generator: public pages (generator, per-type pages,
pricing) and the logged-in app. The API is the Go backend `qrcode_generator_backend`; its
`docs/PLAN.md` ("Customer web app (Next.js)") is the product and security plan this repo follows.

## Mandatory conventions

- All documentation, code comments and commit messages are written in English.
- Package manager: pnpm. Next.js 16 with Cache Components: read the matching guide in
  `node_modules/next/dist/docs/` before using an API (see AGENTS.md); do not rely on older Next.js
  knowledge.
- Use the ECC skills/agents from the table below; never skip the review and verify steps.
- `pnpm check` (lint, typecheck, unit tests) and `pnpm build` pass before every commit.
- When an API request or response shape changes in the backend, update `src/lib/api/types.ts` in the
  same change.

## Languages (mandatory)

- Six languages: en (at the root, no prefix), vi, es, de, fr, pt (prefixed). See README,
  "Languages".
- No user-visible text in components: every string comes from `src/i18n/messages`. A new key is
  added to all six catalogs in the same change (`tsc` fails otherwise); keep `{placeholders}`
  identical.
- Links are built with `localizePath(locale, path)`; never hard-code "/login" in a link.
- API error messages are English: show a translated text chosen by the error `code`.
- Public pages export `alternates: alternatesFor(locale, path)` and are listed in
  `src/app/sitemap.ts`.

## Structure (mandatory)

Two root layouts, one per security surface. Navigating between them is always a full page load, so
a page never keeps the other surface's Content Security Policy.

- `src/app/[lang]/(marketing)/`: public pages. Prerendered and cached at the CDN, indexed. CSP without a
  nonce. Never render user-supplied content; use `publicApi` only (no cookies); never import
  `src/features/auth`.
- `src/app/[lang]/(private)/`: auth pages (`(auth)/`) and the logged-in app (`app/`, served at `/app`).
  Rendered per request with a nonce-based CSP, `noindex`, `Cache-Control: private, no-store`. Use
  `sessionApi`. No third-party scripts.
- A new private path prefix must be added to `PRIVATE_PREFIXES` in `src/lib/security/csp.ts`,
  otherwise it gets the marketing CSP and is not blocked in robots.txt.
- Route files are never imported (ESLint enforces it). Shared code lives in `src/features/<feature>`
  (UI + logic of one feature), `src/lib` (framework-free code: API client, security, navigation) and
  `src/components` (design system).
- Never use `dangerouslySetInnerHTML` (ESLint enforces it); emails, names and QR content are
  user-controlled.
- Redirect targets taken from the URL (`return_to`) go through `safeReturnTo`.
- The session guard (`RequireSession`) is a convenience; the API authorizes every request. Server
  components under `/app` never fetch per-user data: their output is sent before the guard runs.
- Marketing pages never read `searchParams` or other request input: their CSP allows inline
  scripts, so reflecting input there would be an XSS hole on the app's origin.
- `form-action 'self'` also applies to redirects after a form post; an OAuth flow (Google login,
  backend PLAN) must start with a link or `location.assign`, or the CSP must be widened for it.

## Commands

- `pnpm dev`: development server on http://localhost:3000 (the backend's `make up` serves the API
  on http://localhost:8080 and allows this origin).
- `pnpm check`: ESLint, TypeScript, unit tests (Vitest).
- `pnpm test`: unit tests only.
- `pnpm build` / `pnpm start`: production build and server. A production build needs
  `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` (see `.env.example`).

## ECC skills (mandatory)

Load the matching skill before starting work of that kind.

| Kind of work | ECC skill / agent |
|---|---|
| New feature | `ecc:orch-add-feature` |
| Bug fix | `ecc:orch-fix-defect` |
| Change behavior of an existing feature | `ecc:orch-change-feature` |
| Behavior-preserving refactor | `ecc:orch-refine-code` |
| Writing React / Next.js code | `ecc:react-patterns`, `ecc:frontend-patterns`, `ecc:nextjs-turbopack` |
| Writing TypeScript | `ecc:typescript-patterns` |
| Render performance, bundle size | `ecc:react-performance` |
| Writing tests (tests first) | `ecc:tdd-workflow`, `ecc:react-testing` (`ecc:react-test`) |
| End-to-end and browser checks | `ecc:e2e-testing` (agent `ecc:e2e-runner`), `ecc:browser-qa` |
| Visual direction, layout, new screens | `ecc:frontend-design-direction`, `ecc:design-system`, `ecc:brand-discovery` |
| Polishing UI details | `ecc:taste`, `ecc:taste-application`, `ecc:make-interfaces-feel-better` |
| Animation | `ecc:motion-foundations`, `ecc:motion-patterns` |
| Iterating on a design with scoring | `ecc:gan-design` |
| Accessibility | `ecc:accessibility`, `ecc:frontend-a11y` (agent `ecc:a11y-architect`) |
| SEO (public pages) | `ecc:seo` (agent `ecc:seo-specialist`) |
| Translations, adding or changing message keys | `ecc:i18n-sync` |
| Calling or changing an API contract | `ecc:api-design` |
| Build or type errors | `ecc:react-build` (agent `ecc:react-build-resolver`) |
| After changing code | `ecc:react-review` (agents `ecc:react-reviewer`, `ecc:typescript-reviewer`) |
| Code touching auth, user input, redirects, CSP, secrets | `ecc:security-review` (agent `ecc:security-reviewer`) |
| CI/CD, deployment, Docker | `ecc:deployment-patterns`, `ecc:docker-patterns` |
| Before committing or opening a PR | `ecc:verification-loop` |
| Commits, branches, PRs | `ecc:git-workflow`, `ecc:prp-commit`, `ecc:pr` |
