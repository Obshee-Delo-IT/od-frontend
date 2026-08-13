## Why

~170 of the 174 published WordPress pages have no redesigned route, and the catch-all `notFound()`s every
non-numeric path (`src/app/[...slug]/page.tsx:86-89`) — so launching today 404s ~15 % of entry traffic. This
is a named launch gate (`docs/prod-migration-runbook.md:22`), and it is the mechanism that lets every Tier 3–4
page ship as-is instead of blocking the cutover on a complete redesign.

## What Changes

- Add `app/legacy/[...slug]/route.ts` — a same-origin GET proxy that fetches the path from `WP_LEGACY_BASE`,
  reduces it to inner content, rewrites URLs, injects a height reporter, and returns HTML.
- Add a pure HTML transformer in `src/shared/legacy/` — chrome removal, `<base>` injection, navigation-link
  rewriting, stripping, height-reporter injection — with fixture-backed unit tests over real captured pages
  and no new runtime dependency.
- Add path validation + origin pinning so a user-supplied slug cannot move the server-side fetch off the
  configured origin, and ensure the legacy fetch never carries the WordPress `Authorization` header.
- Replace the catch-all's non-numeric `notFound()` with a `LegacyEmbed` render, behind an eligibility check
  (reserved prefixes, dotted last segments, an initially empty denylist).
- Add `LegacyEmbed` — a client component whose iframe height follows the embedded document, validating
  message origin against our own.
- Extend the catch-all's `generateMetadata` to derive title/description for embedded pages from the fetched
  HTML, emitting **our** canonical.
- Strip the legacy Yandex Metrica counter, the legacy canonical/`og:url`/`<base>`, and remove form `action`
  attributes in proxied HTML; build the response from scratch so no upstream header (notably `Set-Cookie`) is
  relayed, and mark `/legacy/*` responses `X-Robots-Tag: noindex` +
  `Content-Security-Policy: frame-ancestors 'self'`.
- Bound the upstream dependency: an abort timeout, a cap on simultaneous upstream requests, response caching
  on our side (so an upstream `no-cache` cannot defeat it), and no caching of failures.
- Wire `WP_LEGACY_BASE`: documented in `README.md`, warn-and-degrade when absent (never throw).
- Amend `docs/legacy-page-fallback.md` — its §3/§5 shell sketch predates the root layout, and its `?embed=1`
  switch is WordPress core's oEmbed card parameter (decisions D3, D4).
- **Not breaking.** Every path this touches currently returns 404; real routes keep winning by App Router
  precedence, and `/category/*` keeps redirecting via `src/proxy.ts`.

## Non-Goals

- **No frozen copy is stood up here.** The origin is configurable and this change points it at live prod
  (D1); standing up the frozen host, its chromeless template and its REST switch stay with A2/the team.
- **No content or Gutenberg migration.** This is design migration only — legacy bodies stay cmsms shortcodes
  rendered by the legacy origin.
- **No native routes.** `/materials/plakati/`, `/contacts/`, `/profile/[slug]` and the rest of the D3/D5/D8
  workstream items in `docs/implementation-plan.md` (not the D-IDs in this change's `decisions.md`) are
  separate work; this change is what lets them be deferred, not a substitute for them.
- **No SSR of legacy content into the React tree.** Explicitly rejected in the design doc and re-affirmed:
  the content is theme-CSS/JS-coupled.
- **No sitemap entries for embedded pages** (ASM7), and no per-page SEO tuning beyond title/description.
- **No retired-page list.** The denylist mechanism ships empty (D12).
- **No new caching infrastructure.** No `cacheHandler`, no CDN rules; the per-replica ISR cache is accepted
  as-is.
- **No `?s=` search on the new site**, even though the legacy form's action gets neutralised.

## Capabilities

### New Capabilities

- `legacy-content-proxy`: the `/legacy/[...slug]` route and its HTML transform — origin resolution and
  pinning, path validation, upstream status mapping, chrome extraction, URL rewriting, stripping, height-
  reporter injection, response headers and caching.
- `legacy-page-fallback`: the catch-all's non-numeric branch — eligibility, the embedded render and its
  auto-height behaviour, metadata and canonical for embedded pages, precedence against real routes and the
  redirect layer, and degradation when the origin is absent or failing.

### Modified Capabilities

<!-- None: openspec/specs/ is empty — this change introduces the first specs in the repo. -->

## Impact

- **Code:** new `src/app/legacy/[...slug]/route.ts`, new `src/shared/legacy/*` (transform + config + tests),
  new `src/modules/Legacy/LegacyEmbed/*`; edits to `src/app/[...slug]/page.tsx` (branch + metadata) and
  `README.md`; doc amendment to `docs/legacy-page-fallback.md`.
- **APIs:** one new internal endpoint, `GET /legacy/<path>/`. Not a public contract — it exists to be the
  iframe's `src` and is `noindex`.
- **Dependencies:** none added.
- **Data:** none. No writes, no persistence, no migration.
- **Operations:** `WP_LEGACY_BASE` becomes a runtime env var in Coolify
  (`docs/prod-migration-runbook.md:200`); the container needs outbound HTTPS to that origin (research U6);
  the legacy origin becomes an availability dependency for un-redesigned pages only.
- **Security posture:** legacy theme scripts execute same-origin (ASM5) — acceptable while the site has no
  auth or cookies, and recorded with an explicit revisit trigger.
- **Verification:** `pnpm url:check` should move from the 83.7 % baseline toward ~100 %
  (`docs/prod-migration-runbook.md:248`).

## Rollback

Unset `WP_LEGACY_BASE` and redeploy: the proxy answers 404, the catch-all `notFound()`s, and the site is
byte-for-byte back to today's behaviour on every affected path — no data to unwind, no URL to un-publish
(embedded pages were never in the sitemap, and the `/legacy/*` twin was `noindex`). If the mechanism is
sound but one page misbehaves, add its slug to the denylist — a one-line config change, no deploy shape
change. Full revert is a single-commit revert; nothing outside the files listed under Impact is touched.

## Carried Assumptions

ASM1 (one `#middle` per page — now informational only, see design D14), ASM2 (chrome removal is behaviourally
inert), ASM3 (legacy origin reachable server-side), ASM4 (iframe SEO priced and accepted), ASM5 (same-origin legacy
scripts acceptable while there is no auth), ASM6 (stripping the legacy Metrica counter loses nothing depended
upon), ASM7 (embedded pages stay out of the sitemap), ASM8 (no `wp_footer` script sits inside a chrome element).
