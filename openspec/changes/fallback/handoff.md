---
gate: handoff
state: READY_FOR_HUMAN
review_minutes: 5
---

# Handoff

## What Changed

The ~170 WordPress pages that have no redesigned route are now served at their live URLs instead of 404ing.
The catch-all's non-numeric branch renders an iframe pointing at a new same-origin proxy,
`app/legacy/[...slug]/route.ts`, which fetches the page from `WP_LEGACY_BASE`, removes the old header and
footer, rewrites its in-content links onto this site, strips the old Yandex counter and canonical, and injects
a script that reports the document's height and routes clicks. A visitor landing on `/team/` from search sees
the new header and footer with the old page between them, at the URL they came for; clicking a link inside it
navigates the whole window to that path on the new site. `pnpm url:check` moves from **83.7 % to 98.8 %**
entry-traffic coverage. Unsetting `WP_LEGACY_BASE` turns the whole thing off and restores today's 404s
exactly.

## Assumptions Taken

Assumption IDs are `ASM…` because this repo already uses `A2`/`A6`/`A8` for workstreams. Two decisions (D1
origin, D2 chrome strategy) were escalated and answered by you; these are the ones taken without asking.

| ID | Assumption | Falsifier | If wrong |
|----|------------|-----------|----------|
| ASM1 | Every legacy page has one `section#middle` | `pnpm legacy:sweep` counts boundary misses — **0 of 172** | Nothing: after design D14 the transform removes chrome rather than keeping `#middle`, so a page without it still renders |
| ASM8 | No `wp_footer` script sits inside a chrome element | `fixtures.test.ts` asserts 0 of 46/58/54; the sweep asserts no script lost on any of 172 pages | Interactive widgets die on that page — the exact capability the iframe exists to preserve. Caught by test, not in production |
| ASM2 | Removing chrome markup does not break in-content theme JS | Open the sample pages with the console open | Sliders or toggles silently fail; fall back to hiding chrome with CSS instead of removing it |
| ASM3 | The legacy origin is reachable server-side from the container | `curl` from inside the container after A2 | Every legacy page 404s in that environment — gracefully, never a 500 |
| ASM4 | An embedded page having **no crawlable content of its own** is acceptable for the transition | Yandex Webmaster over the first weeks | Ranking loss across the ~15 % of entry traffic (≈3 000 of 20 907 entry visits / 91 days) these pages carry; recoverable by prioritising native routes |
| ASM5 | Legacy JS executing same-origin is acceptable | **The first authenticated feature on this site** | Legacy scripts gain read access to a session. There is no auth, no cookie and no user data today; this is the named revisit trigger |
| ASM6 | Stripping the legacy Metrica counter loses nothing depended on | Ask whoever reads the old dashboards | A gap in old-counter continuity for fallback pages. One line to revert |
| ASM7 | Embedded pages stay out of `sitemap.xml` | An SEO review deciding otherwise | Slower discovery of ~170 URLs already linked from the header nav |

## Spot Checks

| # | Check | What correct looks like |
|---|-------|-------------------------|
| 1 | `pnpm build && SITE_URL=http://localhost:3100 pnpm start -p 3100`, then `curl -o /dev/null -w '%{http_code}\n' localhost:3100/team/` — **do this on a clean `.next`** | `200`, and **zero** `⨯` in the server output. `next dev` is not a substitute: a `cache: 'no-store'` fetch inside this ISR route 500s in production and answers 200 in dev. That is the single worst bug this change had, and only this check finds it |
| 2 | Open `src/shared/legacy/legacyRuntime.ts:99-230` — the delegated click handler | The order is: decide same-document **first**, correct the destination **second**, choose the browsing context **last**. Fragments compare against `document.baseURI`, never `location.pathname` (inside the frame that carries a `/legacy/` prefix and matches nothing). Getting this order wrong is what five of GATE 1's eight rounds were about |
| 3 | `node scripts/legacy-sweep.mjs --base http://localhost:3100` (needs a running server and network) | `172 clean, 0 failures, 0 boundary misses`. It runs the real route over every page in the legacy sitemap and checks that none loses a script, keeps its chrome, or leaks a link to the old origin |
| 4 | Open `src/shared/legacy/__fixtures__/README.md` | Three numbers in the specs are **substring** counts, not element counts, and the table records both. If a re-capture ever changes one, `fixtures.test.ts` fails rather than the spec quietly becoming wrong |
| 5 | Unset `WP_LEGACY_BASE`, restart, `curl` `/team/` and `/news/` | `404` and `200`. That is the rollback, and it is a config change with no deploy-shape change |

## Residual Risks

- **The legacy origin becomes an availability dependency** for these paths. Bounded: an 8-second timeout, at
  most 4 concurrent upstream requests process-wide, an hour-long reuse window, and failure closes to 404 rather
  than 500.
  Detection: `[legacy] upstream …` lines in the container log, and `pnpm url:check` falling back toward 83.7 %.
- **`?od_embed=1` bypasses WP Rocket's page cache on the current origin**, so every fallback fetch is a full
  uncached WordPress render (measured: +0.25 s, 70 KB instead of 88 KB). Acceptable — the uncached page is
  arguably better for embedding, since it has no lazy-loading script — but it is real load on live production
  until the frozen copy exists. Detection: origin latency, and `[legacy] upstream busy` if the gate saturates.
- **Regex HTML rewriting on a theme that may change.** Mitigated by masking script/style/comment regions,
  depth-counted element matching, per-element strips, an idempotence property and a golden fingerprint over
  three real pages — but a WordPress theme update could still move the boundary. Detection: `[legacy] boundary
  miss` / `[legacy] unbalanced` in the log, and the sweep.
- **An embedded page is contentless to a crawler.** The indexable URL renders header, iframe and footer; the
  frame's document is `x-robots-tag: noindex`, so what a crawler gets for `/team/` is a title, a description and
  nothing else — where the live site today serves the full page. This is ASM4, restated bluntly after review
  because "iframe-weakened SEO" undersold it, and because the ~170 affected pages carry ~15 % of entry traffic
  rather than the "low-traffic" the row originally claimed. The cheap escape, if Webmaster shows drops: the page
  already fetches and transforms the whole document server-side and discards the HTML to keep the title, so
  rendering that body inline instead of framing it is a smaller step than it looks — what is untested there is
  the CSS collision the iframe was chosen to avoid (D2, D4).
- **Legacy scripts run same-origin** (ASM5). No auth, no cookies, no user data today. The revisit trigger is
  the first authenticated feature, and it is recorded in `LegacyEmbed.tsx` where someone will read it.
- **ISR holds the previous answer.** Flipping `WP_LEGACY_BASE` on a *running* container leaves already-rendered
  pages — including 404s — in the cache until the window rolls. A real rollback is a redeploy, which starts with
  an empty cache, so this does not bite in practice. Worth knowing when testing locally.
- **The panel is not omniscient.** Its most confident finding of the round ("relative XHR resolves against
  `location`") was wrong, and its second ("treat any dotted path as an asset") made a real case worse. Both
  were settled by measurement, not argument.

## Gate Summary

| Gate | Verdict | Rounds | Panel (families) | Unique findings | Unresolved C/M |
|------|---------|--------|------------------|-----------------|----------------|
| GATE 1 spec-review | PASS (+ addendum 2026-08-14) | 8 | 6 reviewers, 3 families | 41 | 0 / 0 |
| GATE 2 impl-review | PASS | 2 | 6 reviewers, 3 families | 12 | 0 / 0 |

| Verification command | Result |
|----------------------|--------|
| `pnpm lint` | pass, `--max-warnings 0` |
| `pnpm lint:styles` | pass |
| `pnpm type-check` | pass |
| `pnpm test` | **526 passed**, 66 files, 0 skipped |
| `WP_BASE= WP_USER= WP_PASSWORD= WP_LEGACY_BASE= pnpm build` | pass — the CI case |
| `pnpm test:e2e -- legacy-embed` | **48 passed**, two viewports |
| `pnpm url:check` | **98.9 %** entry-traffic coverage (from 83.7 %) |
| `curl -sI /legacy/team/` | `x-robots-tag: noindex`, `frame-ancestors 'self'` |
| production build + smoke (gate 10) | 200 / 200 / 200 / 404, 0 server errors |
| `pnpm legacy:sweep` | **172/172 clean**, 0 boundary misses |
| mutation table | 12 of 12 killed |
| coverage of changed lines | **95.2 %** against a 90 % threshold |

## Deferred

- **Point `WP_LEGACY_BASE` at the frozen copy** when it exists. One env var, no code. **It must not stay on
  `obshee-delo.ru` after cutover** — this app becomes that host, and the fallback would fetch itself and embed
  its own shell one frame deeper each time. The app warns at boot; it does not refuse, because the two match
  harmlessly on a developer's machine.
  **One condition on how the copy is made: it has to carry the usual domain search-replace**, so its HTML
  emits its own host. The transform rewrites a link by comparing it against the origin the page was fetched
  from, so a clone still emitting `obshee-delo.ru` links leaves them alone — measured on `/team/`, 32 of 80
  anchors are absolute to the current host (20 more are root-relative and ride the `<base>`, so they are safe
  either way). On production that miss is invisible, since the old host *is* our host by then and the link
  already points at us; on any tier whose `SITE_URL` differs it sends visitors to live production instead.
  `pnpm legacy:sweep` against such a tier is the check, and its link test only compares against the legacy
  origin — so verify by sampling an embedded page's anchors, not by trusting a clean sweep.
- **`resolvePostKind` has no `try/catch`** (`src/app/[...slug]/page.tsx:45-55`). If WordPress is unreachable,
  `wpFetch` rejects and a numeric post URL answers **500** where it should 404. Found by this change's refuter;
  it is pre-existing A8 code that A6 does not touch, so it was left alone rather than widened into this diff.
  Worth a two-line fix.
- **Native routes for the Tier 2 pages** — `/materials/plakati/`, `/materials/zakladki/`, `/contacts/`,
  `/profile/[slug]`. The fallback is what lets them be deferred, not a substitute for them.
- **The denylist ships empty** (D12). The mechanism is in `isEmbeddable.ts`; which legacy slugs should 404
  rather than embed is a content decision nobody has made.
- **Six MINORs carried from GATE 1**, unchanged: no `not-found.tsx` (pre-existing), no JSON-LD on embedded
  pages, no per-page OG image, the `Container` width clamp on full-bleed legacy layouts (D4 — cosmetic, revisit
  only if the pages look broken rather than narrow), no sitemap entries (ASM7), and no on-demand revalidation
  hook for legacy paths.
- **Two GATE 2 MINORs**: the four promised log lines are actually ten (kept as a superset; the runbook lists
  all ten), and a `/legacy/*` failure answers 404 so monitoring cannot distinguish a broken deploy from a
  failing origin (by design — the log line is the distinguishing signal).

## Rollback

Unset `WP_LEGACY_BASE` and redeploy. `/legacy/*` answers 404, the catch-all `notFound()`s, and every affected
path is byte-for-byte back to today's behaviour — verified by hand on a clean build. Nothing to unwind: no
data, no migration, and no URL to un-publish, since embedded pages were never in the sitemap and the
`/legacy/*` twin was always `noindex`.

To revert the code entirely:

```bash
git revert --no-commit 8db113d..2063204 && git commit
```

Six commits, all on `feat/a6-legacy-fallback`, touching nothing outside the files listed in the proposal's
Impact section.

## Anything That Did Not Go To Plan

**The spec changed after GATE 1, so that gate is stale on one requirement.** LCP-010 said every upstream fetch
must be `cache: 'no-store'`. That is impossible on the catch-all page — its `revalidate` is module-level and
shared with the numeric branch, so the render must stay statically generatable, and an uncached fetch inside it
aborts with `DYNAMIC_SERVER_USAGE` and answers **HTTP 500** in production while `next dev` answers 200. The
invariant is now per-surface. The amended text was re-reviewed on its own by the family that did not write it
and found sound, and the spec-review addendum records that along with the new bundle hash — but `inputs_sha256`
in the two review files deliberately no longer matches what GATE 1 originally carried.

**Three of the four most serious defects were invisible to every static gate.** The production 500 passed lint,
types, 515 unit tests and 44 browser tests. A whole suite of negative assertions in `LegacyEmbed.test.tsx` was
vacuous and passed itself. An asset rule I added in response to a review finding made a real case worse and
passed every test — the 172-page sweep caught it on the next run. If you read one thing here, read that: the
gates that earned their keep were `pnpm build && pnpm start`, the mutation table, and `pnpm legacy:sweep`.

**Two numbers in the planning documents did not survive contact with the files.** Script counts of 52/64/60 are
substring counts including six occurrences inside a `document.write('<scr'+'ipt>')` polyfill; there are 46/58/54
real elements. Four of the 30 stylesheets sit in `<!--[if lte IE 9]>` comments. And `section#bottom` is nested
inside `section#page`, not a sibling — a span finder that returned only outermost elements found neither it nor
`#middle`, and every assertion written against that finder passed vacuously. All three are recorded in the
fixtures README and asserted.

**A review pass after GATE 2 found a fourth defect no gate had caught, and it was a prose assumption.**
`legacyPath.ts` stated that Next hands route params already decoded, and built its security argument on it —
"there is no decode-again loop, because `%` is not an allowed character". Params arrive **percent-encoded**, so
the allowlist rejected every Cyrillic slug and `/profile/дегтярёв-алексей-анатольевич/` 404'd on a page that
exists upstream. It survived GATE 1, GATE 2, 515 unit tests, 48 browser tests and a 172-page sweep, because
every one of those used ASCII slugs; `pnpm url:check` is what found it, by replaying real URLs. Segments are now
decoded exactly once before the allowlist sees them. The same pass made the store and the gate `globalThis`
singletons — Next constructs a module-level instance once **per bundle**, so both were per-surface and the
concurrency bound was double what LCP-010 promises — and put `isEmbeddable` on the proxy route so the two
surfaces agree about which paths exist.

**Two process notes.** `pnpm format` was not run repo-wide: 26 files carry pre-existing prettier drift, and
reformatting them would bury this change's diff in unrelated churn. Every file this change touches is clean,
which is also what `lint-staged` enforces. And `CLAUDE.md` was updated with the routing changes, but it is
gitignored in this repo, so that edit is local only.
