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

FROM base AS deps
WORKDIR /app
COPY . .
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

# The credentials are build args too, and this is not optional for a deployed
# image. Without them `httpClient` falls back to its stub, `pnpm build` still
# succeeds — and every prerendered page ships with an **empty header and footer**
# baked in, because the nav menu and the widget area are fetched in the root
# layout. Measured 2026-08-21 on this image: `/` answered 200 with
# `x-nextjs-cache: HIT` and no `<aside>` in the footer at all, while `/news/`,
# which renders on demand, had both. `revalidate = 3600`, so that is an hour of
# an empty shell on the busiest URL of the site.
#
# They are safe here and only here: this is a multi-stage build and nothing from
# `builder` reaches `runner`, so neither the value nor its ARG shows up in the
# shipped image's history. Never move them below.
ARG WP_USER
ARG WP_PASSWORD
ENV WP_USER=$WP_USER
ENV WP_PASSWORD=$WP_PASSWORD

RUN pnpm build

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]