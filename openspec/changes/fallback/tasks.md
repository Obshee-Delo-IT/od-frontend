<!-- Ordered by real dependency. The navigation runtime (group 4) is verified in a browser BEFORE the
     catch-all branch is wired (group 5) — that sequencing is the condition GATE 1's PASS carries. -->

## 1. Scaffolding and fixtures

- [x] 1.1 Capture the three legacy pages as committed fixtures under `src/shared/legacy/__fixtures__/` — `/team/`, `/materials/plakati/`, `/faq/` — with a short README recording the capture date, the `curl` command and the measured numbers the specs assert (52/64/60 scripts, 40/52 after `</footer>`, 33 `/wp-content/` download links, 30 stylesheets, 12 inline styles). [VER: V5, V18, anti-cheat]
- [x] 1.2 Add `WP_LEGACY_BASE` to `.env` locally and document it in `README.md` as the legacy origin, live prod today and the frozen copy later — replacing the "пока не используется" note. [REQ: LCP-001]
- [x] 1.3 Create `src/shared/legacy/` with an `index.ts` barrel, and confirm it is **not** re-exported from `src/shared/api/index.ts` (every neighbour there carries auth). [REQ: LCP-003]

## 2. Pure modules

- [x] 2.1 `legacyOrigin.ts` — parse `WP_LEGACY_BASE` at module load, keep `url.origin` only, warn once, export `null` when absent or unparseable, never throw. [REQ: LCP-001] [VER: V1]
- [x] 2.2 `legacyPath.ts` — positive allowlist per segment (Unicode letters/digits/`-_.~`), reject empty/`.`/`..`, compose with `new URL`, assert `url.origin === origin`, append the fixed `od_embed=1` hint, return `null` on any failure. [REQ: LCP-002] [VER: V2]
- [x] 2.3 `isEmbeddable.ts` — pure eligibility: reserved first segments (`legacy`, `_next`, `api`), dotted last segment, depth bound, and an exported empty `LEGACY_DENYLIST`. [REQ: LPF-001] [VER: V12]
- [x] 2.4 `legacyStore.ts` — bounded success-only map from path to `{ html, title, description, expires }`, oldest-out eviction, injected clock, plus the concurrency gate (cap 4, bounded wait, no silent shedding). [REQ: LCP-010] [VER: V10]

## 3. The transform

- [x] 3.1 `transformLegacyHtml.ts` skeleton: depth-counted element spans with `<script>`/`<style>`/comment regions masked, and the removal of `header#header`, `section#bottom`, `footer#footer` — leaving everything else, so the `wp_footer` scripts survive. Warn on a boundary miss and on unbalanced markup, leaving the element in place rather than truncating. [REQ: LCP-005] [VER: V5, V18]
- [x] 3.2 Element-level strips — Metrica (anchored `\bym\(` or an `mc.yandex.ru` reference), `rel="canonical"`, `og:url`, upstream `<base>`, `<meta http-equiv="refresh">`, and `action` on forms — each iterating elements, never spanning from the document's first matching open tag, and each quote-agnostic. [REQ: LCP-007] [VER: V7]
- [x] 3.3 Anchor rewriting, scoped to `<a>`/`<area>` only: resolve every `href` against the page's own legacy URL, leave fragment-only and non-HTTP schemes alone, leave third-party and `/wp-content|/wp-includes|/wp-json` alone, normalise a same-page-plus-fragment link to fragment-only, and rewrite everything else onto `siteUrl`. [REQ: LCP-011] [VER: V11, V27]
- [x] 3.4 Inject exactly one `<base href="<origin><path>/">` with **no `target`**, after removing any upstream one. [REQ: LCP-006] [VER: V6]
- [x] 3.5 Parse `<title>` and `<meta name="description">` order-insensitively on the way through, decode entities, and return them alongside the HTML so nothing has to parse twice. [REQ: LPF-004] [VER: V15]
- [x] 3.6 Assert idempotence and the golden-file snapshot over all three fixtures. [REQ: LCP-006] [VER: V6, V18]

## 4. The injected runtime, verified in a browser first

- [x] 4.1 Write the injected runtime as a standalone, lint-clean source file that the transform inlines — height reporter (`DOMContentLoaded`, `load`, `ResizeObserver`, bounded ~10 s settling poll), scroll suppression applied **by the script**, delegated `click` handler, and a `submit` handler that prevents every submission. [REQ: LCP-008, LCP-011] [VER: V8, V20–V27]
- [x] 4.2 Build a Playwright fixture page that frames a transformed fixture and exercises the pairwise link matrix — page link, document-relative, query-only, fragment, `href="#"`, download, `target="_self"` download, third-party, `javascript:`, modified click, explicit `target`, form submit by Enter and by button. [VER: V20–V26]
- [x] 4.3 Assert the two invariants that prose review kept missing: no click reaches the legacy origin in any browsing context, and the framed document issues **zero** requests to the site origin. [REQ: LCP-006, LCP-011] [VER: V27, V28]
- [x] 4.4 Assert the height contract and its failure mode: height applies and updates; with the script removed the document still scrolls internally. [REQ: LCP-008] [VER: V8]

## 5. Route and page

- [x] 5.1 `src/app/legacy/[...slug]/route.ts` — GET only (405 otherwise), dynamic (never route-cached), validate → store lookup → concurrency slot → bare `fetch` with `cache: 'no-store'`, `AbortSignal.timeout`, `redirect: 'manual'` and explicitly constructed headers → transform → store on success only. [REQ: LCP-002, LCP-003, LCP-004, LCP-010] [VER: V2, V3, V4, V10]
- [x] 5.2 Construct the response from scratch: `text/html; charset=utf-8`, `X-Robots-Tag: noindex`, `Content-Security-Policy: frame-ancestors 'self'`, `Cache-Control` per outcome, and no upstream header copied — in particular no `Set-Cookie`. [REQ: LCP-009] [VER: V9] 
- [x] 5.3 `src/modules/Legacy/LegacyEmbed/` — client component: an iframe with a Russian `title`, a `60vh` starting height, and a `message` listener gated on `event.origin`, `event.source === iframe.contentWindow`, the message type and a finite height in `(0, 50000]`, cleaned up on unmount. [REQ: LPF-003, LPF-006] [VER: V14, V17]
- [x] 5.4 Wire the catch-all's non-numeric branch: eligibility → render `<LegacyEmbed>` only (the layout owns header and footer) → `notFound()` when ineligible, when the origin is unconfigured, or on a **definitive** upstream 404/410; render the embed anyway on a transient 5xx or timeout. Leave the numeric branch untouched. [REQ: LPF-001, LPF-003, LPF-005] [VER: V12, V14, V16]
- [x] 5.5 Extend `generateMetadata`'s non-numeric branch through the same `cache()`d loader the page uses: upstream title and description, `canonicalUrl(path)` as the canonical, site defaults when the fetch fails, and never a canonical on the legacy origin. [REQ: LPF-004] [VER: V15]

## 6. Observability, docs and rollback

- [x] 6.1 Add the four greppable log lines exactly as designed — `[legacy] WP_LEGACY_BASE missing — legacy fallback disabled` (once at boot), `[legacy] upstream <status> for <path>`, `[legacy] boundary miss for <path>`, `[legacy] rejected path <path>` — since they are this change's only production signal. [REQ: LCP-001, LCP-004, LCP-005, LCP-002]
- [x] 6.2 Verify the rollback path by hand: unset `WP_LEGACY_BASE`, restart, confirm the affected paths 404 exactly as today and that `/`, `/news/`, `/video/*` and `/<id>/` are untouched. [REQ: LPF-005] [VER: V16]
- [x] 6.3 Amend `docs/legacy-page-fallback.md`: its §3/§5 shell sketch predates the root layout (the page renders the embed only), and `?embed=1` is WordPress core's oEmbed-card parameter — record the measured evidence and the `od_embed=1` replacement. Mark A6 as implemented in `docs/implementation-plan.md` and note the remaining frozen-copy leg. [REQ: LCP-006]
- [x] 6.4 Add `WP_LEGACY_BASE` to the runtime-env table in `docs/prod-migration-runbook.md`, note that the container needs outbound HTTPS to that origin, and make `pnpm url:check` an explicit post-deploy step — it is the production signal this change depends on.
- [x] 6.5 Update `CLAUDE.md`'s routing section: the catch-all's non-numeric branch now embeds rather than 404s, `/legacy/*` is internal and `noindex`, and adding a native route retires a fallback with no other edit.

## 7. Verification and gate

- [x] 7.1 Run the ASM1/ASM8 sweep: the transform over all 174 legacy URLs, recording the boundary-miss count and asserting zero external script `src` lost on any page. [VER: V19]
- [x] 7.2 Run every executable gate from verification-plan.md in order (format, lint, lint:styles, type-check, test, secrets-free build, `test:e2e -- legacy-embed`, `url:check`, the `X-Robots-Tag` curl) and record the real output verbatim.
- [x] 7.3 Confirm coverage of changed lines meets the 90 % threshold, and that the injected runtime's exemption is covered by the browser suite rather than skipped.
- [x] 7.4 Produce `reviews/impl-review.md` (GATE 2) and loop until it reads PASS, with the mutation table from verification-plan.md checked by the test-integrity lens.
- [x] 7.5 Produce `handoff.md`, carrying the six open MINORs from GATE 1 and the frozen-copy swap as named follow-ups.
