@AGENTS.md

# ProofQR Frontend

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
- `docker build` with the `NEXT_PUBLIC_*` build arguments: the production image (README, "Docker").
  Keep the `Dockerfile` in step when the build changes (new required variable, files in `public/`).
  `pnpm-workspace.yaml` blocks install scripts (`sharp` included): adding `next/image`
  optimization needs `sharp` allowed and checked in the image.

## Smoke tests (mandatory)

User's rule (2026-11-23, same as the qrtiger repos): every feature is smoke-tested in the user's own
Chrome with **Claude in Chrome** (`mcp__claude-in-chrome__*`, the extension already set up there),
not headless: no `mcp__playwright__*` and no ad-hoc headless scripts.

- Run what ships: kill whatever holds port 3000 (`lsof -ti :3000 | xargs kill`), then
  `pnpm build && pnpm start` with the `NEXT_PUBLIC_*` values (Turnstile: Cloudflare's test key
  `1x00000000000000000000AA`), against the local API (`make up` in the backend; emails in Mailpit at
  http://localhost:8025).
- Open a **new tab** (never take over one of the user's tabs), click through the feature's real
  flows in at least one non-English locale, screenshot each state, read computed styles and
  console errors with the tab's `javascript_tool` / `read_console_messages`.
- **Leave the tab open when done** so the user can look at it.
- Use throwaway accounts on the local stack only (`*@example.com`); never type real credentials,
  and never act on third-party sites while testing.
- Report what was checked, with the screenshots, before committing.

## ECC skills (mandatory)

Load the matching skill before starting work of that kind.

**Enforcement (non-negotiable).**

- Invoke every matching skill with the Skill tool (agents with the Agent tool) before the work it
  covers starts. Reading this table, following existing patterns in the code or running the
  equivalent commands by hand does not count as using a skill.
- Every task, however small (a script, a docs change, a follow-up fix), goes through its
  `ecc:orch-*` pipeline with both gates. An approval covers only the work it named.
- Each step loads its own skills: writing code, writing tests, schema and SQL, API design,
  Docker, review, verification, commit and PR. Loading one skill at the start of a task is not
  enough.
- Before every commit run `ecc:verification-loop`; commit and open PRs through `ecc:prp-commit`
  and `ecc:pr`.
- If a skill cannot be loaded (missing, error), stop and tell the user; never continue without it.
- Every PR description ends with an "ECC skills used" line listing the skills and agents loaded
  for it. A PR without it, or with a matching skill missing, is not ready to merge.

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
| Smoke tests and browser checks | `ecc:browser-qa` with **Claude in Chrome only** (see "Smoke tests"); not `ecc:e2e-runner` or any headless option |
| Interface design: new screens, layout, critique, audit, polish | `impeccable` (installed per machine, see below), with `ecc:frontend-design-direction`, `ecc:design-system`, `ecc:brand-discovery` |
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

## Design skill: impeccable

Product truth lives in `PRODUCT.md` and the visual system in `DESIGN.md` (its frontmatter tokens are
normative; `.impeccable/design.json` carries the extensions). Read both before UI work and keep
new screens inside that system; re-run `/impeccable document` when the system changes.

UI design work uses the `impeccable` skill (https://github.com/pbakaus/impeccable, Apache-2.0). It is
installed per machine, not committed: `npx impeccable install --providers=claude --scope=project`
in this repo (interactive; answer the provider, scope and hook questions). Start a design task by
loading it; it reads `PRODUCT.md` / `DESIGN.md` when they exist. The generator follows its Operate
mode: standard controls, restrained palette with one accent, one signature detail (the preview's
print-proof crop marks and spec line), every browser surface themed (selection, caret, focus,
accent-color). Layout reference: the established QR generators (type row on top, content then
design on the left, sticky preview and download on the right).

