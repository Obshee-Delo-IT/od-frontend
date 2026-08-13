# Verification Plan

Written from the specs before implementation. The spec bundle carries **114 scenarios** across 17
requirements; the map below is grouped by requirement and names every scenario in the group, so each one is
traceable to a verification item without 114 near-identical rows. A scenario that cannot be found in this map
is a gate failure.

**The load-bearing decision in this plan** comes from GATE 1's over-engineering assessment: five of eight
review rounds were spent on the injected navigation runtime, and each of those findings is a one-line
assertion in a real browser. V20–V27 are therefore **required**, not optional, and `tasks.md` sequences them
before the catch-all branch is wired up. Prose review of that runtime has demonstrably reached its limit.

## Coverage Map

| Ver ID | Requirement | Scenarios | Level | What it asserts | Where |
|---|---|---|---|---|---|
| V1 | LCP-001 | configured origin · trailing slash + stray path · absent config · unparseable config | unit | `resolveLegacyOrigin(value)` returns the bare origin or `null`; warns once; never throws | `src/shared/legacy/legacyOrigin.test.ts` |
| V2 | LCP-002 | ordinary path · traversal · percent-encoded traversal · unlisted char/homoglyph · origin hijack · Cyrillic · request query discarded · empty path · fallback disabled | unit | `buildLegacyUrl(segments, origin)` returns a URL or `null`; allowlist accepts letters/digits/`-_.~` only; result always `<origin>/<path>/?od_embed=1` | `src/shared/legacy/legacyPath.test.ts` |
| V3 | LCP-003 | no credentials · incoming cookies not forwarded · same-origin redirect · cross-origin redirect · redirect loop | integration | Route handler called with a stubbed `fetch`; asserts outbound headers contain no `authorization`/`cookie`, and redirect handling by `Location` origin | `src/app/legacy/[...slug]/route.test.ts` |
| V4 | LCP-004 | upstream 404 · origin down · non-HTML · repeated failures | integration | Status mapping to {200,404}; a warn per failure; PDF content-type not proxied | same |
| V5 | LCP-005 | chrome removed · footer scripts survive · head assets survive · chrome element absent · boundary missing · unbalanced markup · tag-like text in script/style/comment · per-element strips | unit | `transformLegacyHtml` over the three captured fixtures: 0 external script `src` lost, 0 stylesheets lost, all three chrome ids gone, body non-empty | `src/shared/legacy/transformLegacyHtml.test.ts` |
| V6 | LCP-006 | base injected · root-relative asset · document-relative asset · srcset et al · third-party preserved · idempotence | unit | Exactly one `<base href>` with no `target`; no asset attribute rewritten; running the transform twice is a fixed point | same |
| V7 | LCP-007 | metrica removed · canonical/og:url removed · meta refresh removed · upstream base removed · form action removed · lookalike script kept · nothing to strip | unit | Fixture assertions: 0 `mc.yandex.ru`, 0 `rel="canonical"`, 0 `http-equiv="refresh"`, 0 surviving `action`, and a script containing `everym(` retained | same |
| V8 | LCP-008 | height on load · height on change · posting fails · not framed · no inner scrollbar while alive · reporter cannot run · late layout change | browser | Playwright: frame reports a height; parent resizes; with the script removed the document still scrolls | `e2e/legacy-embed.spec.ts` |
| V9 | LCP-009 | successful response · Set-Cookie not relayed · hop/cache headers dropped · non-GET | integration | Response headers are exactly the constructed set; upstream `set-cookie`/`content-encoding`/`cache-control` absent; POST → 405 | `route.test.ts` |
| V10 | LCP-010 | repeat request · upstream uncacheable · failure never reused · store bounded · entry expires · slow origin · burst waits · burst exceeds wait | integration | Stubbed upstream with a call counter: second hit makes no call; a failure then a success serves the page immediately; store evicts past capacity; timeout aborts | `src/shared/legacy/legacyStore.test.ts` + `route.test.ts` |
| V11 | LCP-011 (transform half) | every page link rewritten · fragment-only left alone · same-page fragment normalised · non-navigational schemes · only anchors rewritten · attribute quoting | unit | Over the fixtures: resolving every `<a href>` the way a browser would yields **zero** URLs on the legacy origin outside `/wp-content|/wp-includes|/wp-json`; no non-anchor `href` is rewritten | `transformLegacyHtml.test.ts` |
| V12 | LPF-001 | ordinary page · numeric path · reserved prefix · dotted last segment · denylisted · empty denylist · absurd depth | unit | `isEmbeddable(slug)` truth table, pure, no I/O | `src/shared/legacy/isEmbeddable.test.ts` |
| V13 | LPF-002 | native routes win · new route retires fallback · redirect layer owns its prefixes · unknown film segment | integration + manual | `pnpm url:check` (traffic-weighted) plus a curl matrix over `/`, `/news/`, `/video/filmy/`, `/materials/articles/`, `/category/oblast/piter/`, `/news/page/3/`, `/video/not-a-category/` asserting status and hop count | `pnpm url:check`, gate 8 below |
| V14 | LPF-003 | embed rendered · accessible name · shell not duplicated · in-content navigation · multi-segment path · non-ASCII path | unit (RTL) | Renders exactly one iframe, `src` correct and singly-slashed, non-empty Russian `title`; no Header/Footer in the subtree | `src/modules/Legacy/LegacyEmbed/LegacyEmbed.test.tsx` |
| V15 | LPF-004 | title from upstream · canonical is ours · description absent · attribute order · upstream unavailable · no third fetch | unit | `legacyMetadata(html, path)` decodes entities, emits `canonicalUrl(path)`, omits an absent description, reads `content`-first `<meta>` | `src/shared/legacy/legacyMetadata.test.ts` |
| V16 | LPF-005 | origin unconfigured · page absent · transient failure renders embed · metadata stays generic · build without secrets | integration | Page module with a stubbed loader: 404 on upstream 404/410; embed rendered on 5xx; CI build with no env succeeds (gate 6) | `src/app/[...slug]/legacyBranch.test.ts` |
| V17 | LPF-006 | height applied · height updated · foreign origin ignored · same-origin other frame ignored · malformed payload ignored · no message ever · listener cleaned up | unit (RTL) | Dispatches `message` events at the component; asserts the style height changes only for a well-formed message from the iframe's own `contentWindow` | `LegacyEmbed.test.tsx` |
| V18 | LCP-005/006/007/011 (whole transform) | — | unit | Golden-file check: the transform's output over each captured fixture matches a committed snapshot, so any future edit that changes the HTML has to be looked at | `transformLegacyHtml.test.ts` |
| V19 | ASM1 / ASM8 (sweep) | — | manual, once | Run the transform over all 174 legacy URLs; record the boundary-miss count and assert **zero** external script `src` lost on any page | `scripts/` one-off, output pasted into the handoff |
| V20 | LCP-011 | click on a page link navigates the top window | browser | Playwright: click, assert `page.url()` is the site origin and the frame is gone | `e2e/legacy-embed.spec.ts` |
| V21 | LCP-011 | in-page anchor scrolls, navigates nothing · anchor target missing · `href="#"` | browser | Click, assert URL unchanged in both frame and page, and frame `scrollY` moved (or stayed for a missing target) | same |
| V22 | LCP-011 | download does not destroy the page · `target="_self"` download | browser | Click, assert a new page/tab opened and the original page's URL is unchanged | same |
| V23 | LCP-011 | third-party link opens outside the frame | browser | Same shape, asserting the popup URL host | same |
| V24 | LCP-011 | modified click · link with explicit target | browser | Ctrl/middle click and a `target="_blank"` link, asserting the destination host is never the legacy origin | same |
| V25 | LCP-011 | non-HTTP scheme | browser | A `javascript:` link click leaves the URL unchanged and fires no navigation | same |
| V26 | LCP-011 | form submission cannot leave the document | browser | Submit by Enter **and** by button; assert no navigation in frame or top window | same |
| V27 | LCP-011 | scripting unavailable | browser | Same fixture with JS disabled: click every anchor's resolved href and assert none is on the legacy origin | same |
| V28 | LCP-006 invariant / design invariant 7 | — | browser | Record every request the framed page makes; assert **zero** hit the site origin outside the page's own document | same |

**Fixtures.** Three real captured pages, committed under `src/shared/legacy/__fixtures__/`: `/team/`
(profiles, 52 scripts), `/materials/plakati/` (159 cmsms blocks, 33 `/wp-content/` download links, 64 scripts)
and `/faq/` (accordion, `href="#"`). They are the pages the design was measured against, so a regression in
any measured number is a test failure. Captured with `curl`, never fetched at test time (see anti-cheat).

## Case Design

Derived per requirement rather than by intuition:

- **Boundaries / off-by-one.** Path depth at the bound and one over (LPF-001). Store at capacity and one over
  (LCP-010). Height at `0`, `1`, `50000`, `50001` (LPF-006). Redirect hops at the limit and one over (LCP-003).
  Empty path, single segment, maximal segment (LCP-002).
- **Empty and maximal input.** Empty upstream body, `<html></html>`, a document with no `<head>`, and the
  128 KB `/materials/plakati/` capture (LCP-005). Empty denylist — its shipped state (LPF-001).
- **Duplicate and out-of-order invocation.** Transform applied twice must be a fixed point (V6). Two
  concurrent requests for the same cold path must not double-fetch, and must both get the page. A height
  message arriving before the iframe's `load` must still apply.
- **Permission denied / trust boundary.** This change's trust boundary is the message channel and the
  outbound URL: a foreign-origin message, a same-origin message from another frame, and a slug crafted to
  move the fetch off-origin are all explicit cases (V17, V2).
- **Dependency unavailable and slow.** Upstream 404, 410, 500, 502, connection refused, and a response that
  never completes (timeout) — each asserted on both surfaces, because LPF-005 and LCP-004 deliberately answer
  them differently.
- **Pairwise, not full cross product.** Link classification has four independent dimensions — origin
  (legacy / site / third-party), path kind (page / asset), written form (rooted / document-relative /
  query-only / fragment / absolute) and click kind (plain / modified / explicit target). The full cross
  product is 120 cases; the browser suite covers **pairwise** combinations, which is 18, and additionally
  every case named in a spec scenario. Stated here so the gap is deliberate rather than accidental.

## Anti-Cheat Rules

- [ ] No skipped, focused-only or commented-out tests in the final diff
- [ ] No assertion loosened or deleted to make a suite pass. A genuinely wrong existing assertion is a
      finding, not a fix
- [ ] No wall-clock sleeps, no dependence on the current date, **no network access in unit or integration
      tests** — the legacy origin is a committed fixture, never fetched during a test run; the store's clock
      is injected, not `Date.now()`
- [ ] Each new test asserts the scenario's observable, not an implementation detail that will drift. In
      particular: assert *"no href resolves to the legacy origin"*, never *"the regex matched N times"*
- [ ] The fixture files are never edited to make a test pass. If a fixture no longer matches the live site,
      re-capture it as a separate, reviewed change
- [ ] Measured numbers in the specs (52/64/60 scripts, 33 download links, 40-after-`</footer>`) are asserted
      as **invariants of the fixtures**, so weakening them is visible in the diff

| Requirement | Mutation the test must catch |
|---|---|
| LCP-005 | Change removal back to keep-only `#middle` → the "no external script lost" assertion must fail |
| LCP-006 | Add `target="_parent"` to the injected `<base>` → a browser test must fail |
| LCP-011 | Restrict the href rewrite to rooted paths only → V27 (scripting disabled) must fail |
| LCP-011 | Delete the `submit` listener → V26 must fail |
| LCP-011 | Compare against `location.pathname` instead of `document.baseURI` → V21 must fail |
| LCP-002 | Swap the allowlist for a denylist of `/ \ : @ % .` → the homoglyph case must fail |
| LCP-003 | Swap the bare `fetch` for `wpFetch` → the no-`Authorization` assertion must fail |
| LCP-009 | Copy upstream headers onto the response → the `Set-Cookie` assertion must fail |
| LCP-010 | Store failures as well as successes → "failure never reused" must fail |
| LCP-008 | Move scroll suppression back into static CSS → the reporter-cannot-run case must fail |
| LPF-005 | `notFound()` on 5xx → the transient-failure case must fail |
| LPF-006 | Drop the `event.source` check → the same-origin-other-frame case must fail |

## Executable Gates

Run in this order; re-run after the final code change and recorded verbatim in the impl-review front matter.

| # | Command | Expected signal |
|---|---|---|
| 1 | `pnpm format` | no diff afterwards |
| 2 | `pnpm lint` | clean, `--max-warnings 0` |
| 3 | `pnpm lint:styles` | clean |
| 4 | `pnpm type-check` | no errors |
| 5 | `pnpm test` | all pass, including the new suites |
| 6 | `env -u WP_BASE -u WP_USER -u WP_PASSWORD -u WP_LEGACY_BASE pnpm build` | succeeds — proves LPF-005's CI case and that nothing throws at module load |
| 7 | `pnpm test:e2e -- legacy-embed` | all pass (needs `pnpm dev` and `WP_LEGACY_BASE` set) — **required despite e2e not being in CI**, per the GATE 1 condition |
| 8 | `pnpm url:check` | coverage **materially above** the 83.7 % baseline and no *shape* failure; the previously-404ing `/about/*`, `/materials/*`, `/profile/*` rows now 200 |
| 9 | `curl -sI localhost:3000/legacy/team/ \| grep -i x-robots-tag` | `noindex` present |

## Thresholds

- **Coverage of changed lines: 90 %.** The transform, the path validator and the store are pure functions
  with no excuse for gaps; the route handler's error branches are all reachable with a stubbed `fetch`. The
  injected runtime string is exempt from line coverage (it is data to Vitest) and is covered by V20–V28
  instead — that substitution is the reason the browser gates are mandatory.
- T3 only — mutation testing: **not applicable** (T2). The mutation table above is the manual substitute and
  is checked by the test-integrity lens at GATE 2.

## Production Signal

Within an hour of a bad deploy, in order of speed:

1. **`pnpm url:check` against the deployed URL** — the traffic-weighted gate. A drop from ~100 % back toward
   83.7 % means the fallback is not serving; a *shape* failure means it is serving the wrong thing. This is
   the one check that is run deliberately after deploy (runbook gate 12).
2. **Container logs**, greppable by design (design § Observability): `[legacy] WP_LEGACY_BASE missing` once at
   boot explains a fleet-wide 404; a rising rate of `[legacy] upstream <status> for <path>` is the origin
   failing; `[legacy] rejected path` is someone probing; `[legacy] boundary miss` is ASM1 breaking.
3. **Yandex Metrica on the *new* counter** — fallback pages are ~15 % of entries, so their disappearance from
   the entry report inside a day is a second, independent signal.

There is no alerting stack in this project and adding one is out of scope, so signal (1) is the contract:
**the runbook's post-deploy step must run `pnpm url:check`**, and `tasks.md` includes updating the runbook to
say so. Without that, a silent regression on ~170 pages would be noticed only by a visitor.
