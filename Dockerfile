# syntax=docker/dockerfile:1

# Customer web app (marketing pages and /app): one Next.js standalone server.
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they are build
# arguments, not runtime environment variables: build one image per environment.
#
#   docker build -t proofqr-web \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com \
#     --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key> .

# Images are pinned by digest; bump the tag and the digest together.
# The runtime's Node patch version comes from distroless and may trail the builder's (same major).
ARG NODE_IMAGE=node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs22-debian12:nonroot@sha256:13593b7570658e8477de39e2f4a1dd25db2f836d68a0ba771251572d23bb4f8e

# --- base: pnpm via corepack (version from package.json "packageManager"), fetched once.
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY package.json ./
RUN corepack enable && pnpm --version

# --- deps: install from the lockfile only, so this layer is cached until it changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# --- build: compile the standalone server.
FROM base AS build
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# src/lib/config.ts fails the build when a required NEXT_PUBLIC_* value is missing.
RUN pnpm build

# --- runtime: distroless Node, no shell or package manager, non-root (uid 65532).
FROM ${RUNTIME_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=build --chown=nonroot:nonroot /app/.next/static ./.next/static
# public/ is empty (icons are metadata routes under src/app); copy it here once it holds files.
USER nonroot
EXPOSE 3000
# No shell or wget in distroless: probe with Node itself.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# The distroless entrypoint is node.
CMD ["server.js"]
