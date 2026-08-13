# Research

<!-- Every claim below carries a path:line reference or is labelled Assumption. -->

## Question

**User's words:** "A6 legacy-iframe fallback".

**Restated:** ~170 of the 174 published WordPress pages have no redesigned route. The catch-all
`app/[...slug]/page.tsx` `notFound()`s on every non-numeric path (`src/app/[...slug]/page.tsx:86-89`), so
those pages 404 today — ~15 % of entry traffic, and a launch gate
(`docs/prod-migration-runbook.md:22`, `docs/implementation-plan.md:73`). Build the mechanism that serves each
un-redesigned page as its **old inner content inside the new shell**: a same-origin proxy route that fetches
the page from a legacy WordPress origin and returns it chromeless, plus an auto-height iframe rendered from
the catch-all's non-numeric branch. Each redesigned route must automatically retire its own fallback.

**Risk tier: T2.** Additive (one new route + one new branch), but it introduces the app's first
server-side fetch of an *untrusted-shaped* remote HTML document and sits on the launch-gate path.

**Panel note — read this before trusting the Rounds table.** `reviewers.yaml` calls for a parallel
subagent/`agy` panel here. This session runs under an explicit standing instruction not to spawn agents
unless the user asks, so all lenses were executed **inline by the orchestrator** instead. Breadth was bought
with live HTTP probes against the real legacy origin rather than with model diversity — which is why the
findings below lean on measured bytes rather than on reading alone. Treat the single-family limitation as a
known weakness of this artifact, not as a claim of panel coverage.

## Rounds

| Round | Lenses run                 | Subagents             | New findings | Cumulative |
|-------|----------------------------|-----------------------|--------------|------------|
| 1     | L1, L2, L4, L5, L7         | 0 (inline, see note)  | 11           | 11         |
| 2     | L3, L8 + live-origin probe | 0 (inline, see note)  | 9            | 20         |
| 3     | L2/L3 re-probe, 7 URLs     | 0 (inline, see note)  | 0            | 20         |
| 4     | L2 script placement        | 0 (inline, see note)  | 1            | 21         |

Round 3 re-probed the content boundary and asset forms across seven differently-shaped legacy pages and added
nothing new. **Round 4 was opened after the fact**, when the GATE 1 panel questioned whether `wp_footer`
scripts survive extraction — the measurement it produced (L2, script placement) changed the design, which is
the honest reason this table does not end at zero.

## Findings

### L1 Current behaviour and call graph

- The catch-all is the only route that can serve an arbitrary path. Its non-numeric branch calls
  `notFound()` with a comment naming this change as its filler. `src/app/[...slug]/page.tsx:83-97`
- It resolves a bare numeric slug through a `cache()`d `_fields=id,format` probe using raw `wpFetch`
  (a 404 is an expected answer there, so the throwing middleware is wrong). `src/app/[...slug]/page.tsx:39-49`
- `generateMetadata` in the same file returns `{}` for any non-numeric path — the seam for legacy page
  metadata. `src/app/[...slug]/page.tsx:65-81`
- Route params are `Promise<{ slug: string[] }>` and `slug` is **already URL-decoded** by Next.
  `src/app/[...slug]/page.tsx:65,83`
- **The root layout already renders the shell.** `HeaderServer`, `Container`, `Footer` wrap every route.
  `src/app/layout.tsx:59-67`. So the fallback page body must render **only** the embed — the architecture
  sketch in `docs/legacy-page-fallback.md:43-46` ("`<Header/>` + `<LegacyEmbed/>` + `<Footer/>`") predates
  that layout and is stale. Following it literally would double the header and footer.
- `Container` clamps width to `--container-4` / `--container-3` / `--container-2` and adds 16px mobile
  padding. `src/shared/ui/components/Container/Container.module.css:1-16`. Legacy pages are full-bleed
  (`section.content_wrap.fullwidth`, measured), so an embed inside `Container` is width-constrained.
- `src/proxy.ts` runs before the catch-all and its matcher is scoped to `/video/:path*`, `/news/:path*`,
  `/category/:path*`, `/page/:path*`. `src/proxy.ts:35-37`. Nothing else enters the redirect layer, so the
  fallback owns every other path.
- Real routes that must keep winning over the catch-all: `/`, `/news/`, `/video/`, `/video/[segment]/`,
  `/materials/articles/`, `/health/`, `/sitemap.xml`, `/robots.txt`.
  `src/app/` listing + `src/app/materials/articles/page.tsx:1`

### L2 Invariants, contracts, data model

- **`trailingSlash: true`** — every URL answers only in slashed form. `next.config.ts:18`. Proxied paths
  therefore arrive slashed and must not be double-slashed when re-composed.
- `canonicalUrl()` always emits the slashed form and strips a leading/duplicate slash;
  `fileUrl()` is the dotted-file exception. `src/shared/config/site.ts:29-41`
- Redirects must stay in `src/proxy.ts`, never `next.config.ts` `redirects()` — a config table
  double-hops under `trailingSlash` and shadows the proxy. `src/proxy.ts:10-16`,
  `src/shared/config/legacyRedirects.ts:50-56`
- **`/category/*` never reaches the fallback** — `resolveLegacyUrl` closes that family exhaustively
  (unmapped archives → `/news/`). `src/shared/config/legacyRedirects.ts:87-109`
- The catch-all's `revalidate = 3600` and `dynamicParams = true` are module-level, so **the legacy branch
  inherits the post branch's cache policy** — it cannot have its own. `src/app/[...slug]/page.tsx:25-26`
- **Measured legacy DOM contract** (live `https://obshee-delo.ru`, 2026-08-13): exactly one
  `<header id="header">`, one `<section id="middle">`, one `<section id="bottom">` (footer widget area) and
  one `<footer id="footer">`, all inside `<div id="main">`. Verified on `/team/`, `/rekvizit/`,
  `/materials/printed-products/`, `/projects/`, `/conf_politics/`, `/faq/`, `/materials/plakati/` — 1 of each
  on all seven, page sizes 68–128 KB. The content boundary is `#middle`; the chrome is `#header`, `#bottom`,
  `#footer`. `#middle` includes the legacy `.headline` (page title) and `.cmsms_breadcrumbs`.
- `<meta charset="UTF-8">`, no `<base>` tag, no `<iframe>` in page bodies. Measured.
- **Script placement, measured (round 4, prompted by the GATE 1 panel):** on `/team/` 12 of 52 `<script>` tags
  are in `<head>` and **40 sit after `</footer>`**; on `/materials/plakati/` it is 12 and **52 of 64**.
  **Zero** scripts sit inside `header#header`, `section#middle`, `section#bottom` or `footer#footer` on either
  page. So `wp_footer()` output lives *between* `</footer>` and `</body>`, which means an extraction that
  **keeps** `#middle` discards every interactive bootstrap (jQuery, cmsms widgets) while an extraction that
  **removes** the three chrome elements keeps all of them. This is the single measurement that decided the
  transform's shape (design D14).

### L3 Failure modes: retries, idempotency, concurrency

- **`?embed=1` is a reserved WordPress core query var and does NOT mean "chromeless".** Measured:
  `GET /team/?embed=1` returns 21 685 bytes of WP's **oEmbed card** template — `div.wp-embed`,
  `.wp-embed-excerpt`, a share dialog — with **zero** `cmsms_row` blocks and no `#header`/`#footer`, versus
  85 641 bytes for the real page. Using `?embed=1` as the chromeless switch (as
  `docs/legacy-page-fallback.md:31,37` proposes) would silently serve an excerpt card instead of the page
  content. The switch must be a non-core query var.
- **REST is off on the legacy origin.** `GET /wp-json/wp/v2/pages?per_page=1` → **404**. Confirms
  `docs/wp-backend.md` / `docs/legacy-page-fallback.md:22`. So metadata for embedded pages cannot come from
  wp-json; it must be parsed out of the fetched HTML (`<title>`, `<link rel=canonical>` are both present —
  measured; `<meta name="description">` was **absent** on `/team/`).
- Upstream 404 is a real 404 (`/definitely-not-a-page-xyz/` → 404), so the proxy can distinguish
  "page does not exist" from "origin down" and the catch-all can `notFound()` accordingly.
- Upstream serves gzip (`content-encoding: gzip`) — `fetch` decompresses transparently; re-emitting a stale
  `content-encoding` header from the upstream response would corrupt the body.
- Legacy origin is slow-ish WordPress with `cache-control: max-age=0` — every proxied request is a full
  origin render unless we cache. The `/legacy` route needs its own revalidate window; the WP host is the
  same class of dependency as `WP_BASE`, which already needs retry/concurrency limits at build time
  (`next.config.ts:69-72`, `src/app/sitemap.ts:31-38`).
- The catch-all's `generateStaticParams` seeds only numeric ids (`src/app/[...slug]/page.tsx:51-63`), so
  every legacy page is rendered on-demand at first hit — no build-time coupling to the legacy origin.
  Good for build reliability; means first-hit latency is upstream latency.
- **No `not-found.tsx` exists anywhere in `src/app/`** (measured) — a denylisted or missing legacy page gets
  Next's default 404 page, i.e. no header/footer and no Russian copy.

### L4 Consumers and integrations

- `pnpm url:check` (`scripts/check-legacy-urls.mjs`) is the traffic-weighted regression gate and explicitly
  names this change as the reason its current 404s are benign: `scripts/check-legacy-urls.mjs:19-22`.
  Baseline to beat: **83.7 %** coverage, and `docs/prod-migration-runbook.md:248` predicts "near 100 %" once
  this lands. That makes it the natural acceptance measurement.
- `sitemap.ts` lists home, `/news/`, `/materials/articles/`, the catalogue and every post id — **no WP
  pages**. `src/app/sitemap.ts:172-196`. Embedded pages are therefore undiscoverable via our sitemap unless
  added.
- `WP_LEGACY_BASE` is already documented as the frozen-copy origin and marked unused:
  `README.md:21`, `docs/prod-migration-runbook.md:200`.
- Four pages behind the fallback are explicitly *not* meant to stay there — `/materials/plakati/` (501
  entries), `/materials/zakladki/` (150), `/contacts/` (545), `/profile/*` (565) are Tier 2 native routes.
  `docs/legacy-page-fallback.md:93`
- The legacy page's own search form posts to `action="https://obshee-delo.ru"` (measured) — after cutover
  that origin is the frozen copy, and the new site has no `?s=` handler.
- `docs/wp-backend.md:157` — the frozen copy must keep cmsms + welfare + UI plugins alive even though they
  are deleted everywhere else. The fallback's fidelity depends on that host not being cleaned up.

### L5 Existing tests and fixtures

- `src/shared/config/legacyRedirects.test.ts` is the model for testing a pure URL function, and asserts an
  invariant of the same class this change needs (no numeric category id in any destination) —
  see `CLAUDE.md` routing notes.
- 45 co-located `*.test.ts(x)` files exist; string/URL transformers are consistently unit-tested pure
  functions: `src/shared/api/imageUrl.test.ts`, `src/modules/News/utils/resolveContentImages.test.ts`,
  `src/modules/Video/utils/absolutizeWpMedia.test.ts`. `resolveContentImages` is the closest prior art —
  an HTML-string rewriter with a unit test.
- A route handler is already unit-tested directly: `src/app/health/route.test.ts`.
- Vitest is jsdom + RTL, no globals, CSS Modules unscoped. `vitest.config.ts`, `vitest.setup.ts`
  (per `CLAUDE.md`).
- E2E is a single `e2e/home.spec.ts` and is **not in CI** (`CLAUDE.md` commands section), so Playwright
  cannot be the gate for iframe height behaviour.
- CI runs typegen → lint → type-check → test → build **without WP secrets**; `httpClient` substitutes a stub
  when env is missing (`src/shared/api/httpClient.ts:5-17,45-48`). Anything new that reads env at module
  load must degrade the same way or CI breaks.

### L7 Configuration, flags, migration, rollback

- Env is read **at module load**, and `WP_BASE`/`WP_MEDIA_CDN` additionally feed build-time
  `images.remotePatterns` (`next.config.ts:51-58`, `CLAUDE.md` env section). `WP_LEGACY_BASE` is only needed
  at *runtime* by the proxy route, so it does **not** need to be a Docker build-arg — unless legacy images
  are ever routed through `next/image`, which the iframe avoids by construction.
- Rollback is config-shaped: unset `WP_LEGACY_BASE` and the fallback must degrade to today's 404 rather than
  throw. `src/shared/api/httpClient.ts:7-13` is the established pattern (warn + stub).
- ISR cache is per-replica on the container filesystem (`output: 'standalone'`, `next.config.ts:7`;
  `CLAUDE.md` rendering model), so proxy caching does not survive a redeploy and is not shared across
  replicas.
- The legacy origin decision for this build is **live prod `https://obshee-delo.ru`**, swapped to the frozen
  copy later by env alone (user decision, this session). Measured today: reachable, HTTP/2 200, real welfare
  + cmsms markup.
- `next.config.ts:15` still refers to `src/middleware.ts`; the file is `src/proxy.ts`. Stale comment, no
  functional effect.

### L8 Security, permissions, tenancy, PII

- **The proxy route is an SSRF surface.** `/legacy/[...slug]` composes a URL from user-controlled path
  segments; without validation, `..`, an absolute URL, a `@`, a scheme or a backslash in a segment could
  redirect the server-side fetch off the intended origin. Nothing in the repo does this today — there is no
  existing route handler that fetches a URL derived from user input (`src/app/health/route.ts` is static).
- **The proxy must not forward credentials.** `wpFetch` unconditionally attaches
  `Authorization: Basic …` (`src/shared/api/httpClient.ts:45-58`) — using it for the legacy fetch would send
  the WordPress application password to a different origin. The legacy fetch must use plain `fetch`.
- Returning upstream HTML from our own origin means **any script in that HTML runs same-origin** — it can
  read our cookies and reach our routes. The legacy page carries ~52 `<script>` tags and 12 inline
  `<style>` blocks (measured). The site has no auth and no cookies today, so the blast radius is currently
  nil, but this is the fallback's permanent security property and belongs in the spec, not in a comment.
- The legacy page embeds **Yandex Metrica** (`mc.yandex.ru` — 2 hits in `/team/`, measured). Proxying it
  as-is double-counts every fallback pageview into the *old* site's counter and pollutes the migration
  measurement.
- Upstream sends **no** `X-Frame-Options` and **no** CSP (measured full header set). Not load-bearing —
  same-origin proxying sidesteps both — but it means a direct hotlink of the legacy origin would also frame.
- Asset URL forms, measured on `/team/`: 51 absolute to the legacy origin, 20 **root-relative**
  `<img src="/wp-content/uploads/…">`, and root-relative `url(/wp-content/themes/welfare/fonts/…)` inside
  the 12 inline `<style>` blocks. Root-relative references resolve against **our** origin inside the iframe
  and 404, so rewriting is mandatory and must cover inline CSS, not just attributes. External stylesheets
  need no inner rewriting — once their `<link href>` is absolute, their own `url()`s resolve against the
  stylesheet's URL.
- 39 root-relative `href="/…"` values are in-content **navigation** links (`/about/`, `/contacts/`, …).
  Those are already the form we want: left alone they keep the visitor inside the new shell.

## Constraints Discovered

1. **The shell is in the layout, not the page.** The fallback page renders only the embed; rendering
   Header/Footer there would duplicate them. `src/app/layout.tsx:59-67`
2. **The legacy branch cannot have its own `revalidate`** — route segment config is module-level and shared
   with the `/<id>` post branch, which carries 46 % of site entries. `src/app/[...slug]/page.tsx:25-26`
3. **`?embed=1` is unusable as the chromeless switch** — WP core claims it for the oEmbed card. Measured.
4. **No wp-json on the legacy origin** — metadata must be parsed from the fetched HTML. Measured (404).
5. **Root-relative assets and inline-CSS `url()` must both be rewritten**; external CSS must not be.
   Measured.
6. **The legacy fetch must not use `wpFetch`** — it would leak `Authorization: Basic` cross-origin.
   `src/shared/api/httpClient.ts:45-58`
7. **The path→URL composition must be validated against SSRF and traversal** before any fetch.
8. **Must degrade to 404, not 500, when `WP_LEGACY_BASE` is unset** — CI builds and runs with no WP env at
   all. `src/shared/api/httpClient.ts:5-17`
9. **`/category/*` must keep redirecting** and never fall into the embed.
   `src/shared/config/legacyRedirects.ts:87-109`
10. **Real routes always win**; adding a native route must retire its fallback with no other edit.
11. **New deps are unwelcome** — the repo rewrites HTML strings with regex + unit tests
    (`resolveContentImages`); `jsdom` is dev-only, `html-react-parser` is for React output, not a rewriter.
12. **`pnpm url:check` is the acceptance gate**, and `pnpm lint --max-warnings 0` + `pnpm type-check` are
    hard CI gates.

## Unresolved Contradictions

- **`docs/legacy-page-fallback.md` §3/§5 vs. the code, on two counts.** It says the catch-all renders
  `<Header/>` + `<LegacyEmbed/>` + `<Footer/>` (`:43-46`) — but `src/app/layout.tsx:59-67` already renders
  both, so the doc is stale; and it specifies `?embed=1` as the chromeless switch (`:31,37`) — measurement
  shows core owns that parameter. **Resolved by reading the code and probing the origin**: the doc is wrong
  on both, and this change corrects it. Recorded here rather than silently ignored because the doc is the
  cited source of truth for A6 and must be amended as part of the work.
- Nothing else. Where docs and code disagreed on `middleware.ts` vs `proxy.ts` (`next.config.ts:15`), the
  code is authoritative and the comment is simply stale.

## Open Unknowns

| ID | Unknown | Blocking? | Cheapest way to close it |
|----|---------|-----------|--------------------------|
| U1 | Frozen copy: host, URL, and whether a chromeless template + REST can be added there. | **No longer blocking** (decided this session: build against live prod, swap by env). Blocks the *frozen* leg of A6 only. | Ask the team / A2 hosting; the code change is one env var. |
| U2 | Which legacy slugs should 404 rather than embed (retired pages)? | No — ship with an empty denylist and the mechanism in place. | One pass over the 174-page list with the content owner. |
| U3 | Should embedded pages be listed in `sitemap.xml`? Iframe content is not in the parent DOM, so a listed URL indexes as a near-empty page. | No — omit them, as today. | Decide with the SEO tiering; revisit if a fallback page must rank. |
| U4 | Does any legacy page depend on the welfare header/footer *scripts* for in-content behaviour (i.e. breaks when `#header`/`#footer` are stripped)? | No — the ~52 scripts are all still loaded from `wp_head`/`wp_footer`; only the markup is dropped. Verify visually on the 5-page sample. | Step in the verification plan: eyeball the sample. |
| U5 | Legacy pages carry Yandex Metrica; is double-counting into the old counter acceptable during the window? | No — strip it, which is strictly safer and reversible. | Confirm with whoever reads the Metrica dashboards. |
| U6 | Prod outbound HTTPS from the container to the legacy origin (A2 topology). | No for dev; **yes for prod deploy**. | Curl the legacy origin from inside the deployed container once A2 lands. |
