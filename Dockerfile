# Debian rather than Alpine, and the reason is the build and not the runtime:
# musl's resolver does not retry and does not cache, so the prerender — which
# makes hundreds of requests to WordPress from a few parallel workers — dies part
# way through with `getaddrinfo EAI_AGAIN`, reproducibly, on a machine whose DNS
# is otherwise fine (measured 2026-08-21: a single `getent` inside the same
# sandbox resolves, `--network host` does not help). glibc handles it.
FROM node:22.16.0-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && corepack use pnpm@11.3.0

# Only the manifests, so this layer survives every source-only commit — the CI
# build restores it from the GitHub Actions cache instead of re-installing
# ~1500 packages on each push. The `dev` target mounts the repo over /app, and
# `builder` copies the tree in itself, so nothing else needs the sources here.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS dev
WORKDIR /app
ARG HOSTNAME="0.0.0.0"
CMD ["pnpm",  "dev"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Evaluated at build time, so they cannot be left to the runtime env:
# `images.remotePatterns` is read out of `next.config.ts` while the bundle is
# built, and an unset WP_BASE there makes every `next/image` request 400 on the
# deployed site. SITE_URL is the same class — `sitemap.xml`, `robots.txt` and
# every canonical are generated here, and its default is production's own host,
# so a tier that does not pass it advertises prod's URLs. None of the three is a
# secret.
ARG WP_BASE
ARG WP_MEDIA_CDN
ARG SITE_URL
ENV WP_BASE=$WP_BASE
ENV WP_MEDIA_CDN=$WP_MEDIA_CDN
ENV SITE_URL=$SITE_URL

# The credentials are needed *during* the build and are deliberately NOT build
# args. Without them `httpClient` falls back to its stub, `pnpm build` still
# succeeds — and every prerendered page ships with an **empty header and footer**
# baked in, because the nav menu and the widget area are fetched in the root
# layout. Measured 2026-08-21 on this image: `/` answered 200 with
# `x-nextjs-cache: HIT` and no `<aside>` in the footer at all, while `/news/`,
# which renders on demand, had both. `revalidate = 3600`, so that is an hour of
# an empty shell on the busiest URL of the site.
#
# **Why a secret mount and not an ARG.** A build arg is recorded in the build's
# `frontendAttrs`, and `docker/build-push-action@v6` uploads that record as a
# workflow artifact by default — on this public repo that published the od-stage
# application password, in cleartext, on every push to `main` until 2026-08-23.
# `provenance: false` closes a different channel and did not help; the value was
# also inside an SLSA predicate embedded in the same bundle. A secret mount
# exists only for the lifetime of this RUN: no attestation, no build record, no
# layer, nothing to leave out of `runner`.
#
# The mounts are optional (BuildKit's default), so a build that supplies neither
# still succeeds — on the stub, with the empty shell described above. That is the
# right failure mode for a local `--target builder` smoke test and the wrong one
# for a deploy, so the CI job passes both.
RUN --mount=type=secret,id=wp_user \
    --mount=type=secret,id=wp_password \
    WP_USER="$(cat /run/secrets/wp_user 2>/dev/null)" \
    WP_PASSWORD="$(cat /run/secrets/wp_password 2>/dev/null)" \
    pnpm build

FROM base AS runner
WORKDIR /app
# curl is the health probe's only requirement: Coolify runs the check *inside*
# the container, and node:*-slim ships neither curl nor wget — with neither, the
# probe fails on a container that serves fine.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The ISR cache is a Docker volume in production. Docker seeds a fresh named
# volume from the image's directory — including its ownership — so the directory
# has to exist here and belong to `nextjs`, or the mount lands root-owned and
# every ISR write fails at runtime.
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache
USER nextjs
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]