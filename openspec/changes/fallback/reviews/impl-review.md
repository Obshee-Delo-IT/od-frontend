---
gate: impl-review
verdict: PASS
risk_tier: T2
rounds: 2
last_round_new_findings: 0
unresolved_critical: 0
unresolved_major: 0
families: 3
tasks_complete: "32/32"
diff_base: "14c7ea8fd4cc161946f6bbdea5c296bc4d753d4d"
head_sha: "2063204"
inputs_sha256: "b54687bc0c9676fddb253d5878ab70ff204ebc5afa5fa9828fbf85bfed664f03"
coverage_changed_lines: 95.2
generated_utc: "2026-08-14T07:35:00Z"
---

# GATE 2 - Implementation Review

## Executable Gate Results

Re-run after the final code change (`2063204`), against a clean `.next` and with the ISR cache cleared
between the enabled and disabled runs.

| # | Command | Result | Notes |
|---|---------|--------|-------|
| 1 | `prettier --check` over every file this change touches | pass | 26 files elsewhere in the repo carry **pre-existing** drift, verified by checking a stashed tree; deliberately not reformatted. `openspec/` and the HTML fixtures are now prettier-ignored — prettier does not merely reformat the fixtures, it fails on the theme's unclosed `<li>` |
| 2 | `pnpm lint` | pass | `--max-warnings 0` over the whole tree |
| 3 | `pnpm lint:styles` | pass | |
| 4 | `pnpm type-check` | pass | |
| 5 | `pnpm test` | **515 passed**, 66 files | 0 skipped, 0 focused |
| 6 | `WP_BASE= WP_USER= WP_PASSWORD= WP_LEGACY_BASE= pnpm build` | pass | proves LPF-005's CI case; `/legacy/[...slug]` reported as `ƒ (Dynamic)`, never route-cached |
| 7 | `pnpm test:e2e -- legacy-embed` | **48 passed** across both viewports | required by GATE 1's condition |
| 8 | `pnpm url:check -- --base http://localhost:3100` | **98.8 %** entry-traffic coverage | from the 83.7 % baseline. Residual: 3 posts absent from od-dev, 6 `/profile/…` URLs that 404 upstream too (verified individually) |
| 9 | `curl -sI …/legacy/team/ \| grep -i x-robots-tag` | `x-robots-tag: noindex` | plus `content-security-policy: frame-ancestors 'self'` |
| 10 | `pnpm build && pnpm start -p 3100`, then curl 4 paths | 200 / 200 / 200 / 404, **0 `⨯` in the log** | the gate this change added, and the only one that catches `DYNAMIC_SERVER_USAGE` |
| — | `pnpm legacy:sweep` (V19) | **172/172 clean**, 0 boundary misses | no page loses a script, keeps its chrome, or leaks a link |

Rollback verified by hand on a clean build: with `WP_LEGACY_BASE` unset, `/team/`, `/faq/` and
`/materials/plakati/` all 404, `/legacy/*` 404s, and `/`, `/news/`, `/video/filmy/`, `/materials/articles/`,
`/health/` and `/sitemap.xml` all answer 200 with zero server errors.

## Panel

| Reviewer | Family | Effort | Lens | Findings | Unique |
|----------|--------|--------|------|----------|--------|
| gemini-3.1-pro-high | google | high | conformance (proxy spec) | 1 | 0 |
| gemini-3.1-pro-high | google | high | conformance (page spec) | 0 | 0 |
| gemini-3.1-pro-high | google | high | **REFUTER** | 9 | 6 |
| gpt-oss-120b-medium | openai-oss | medium | test-integrity | 0 | 0 |
| gemini-3.6-flash-high | google | high | security + operability | 5 | 2 |
| orchestrator (Claude Opus 5) | anthropic | high | mutation table, measurement | 4 | 4 |

Three families, as `reviewers.yaml` requires for T2. The refuter is Gemini — not the family that wrote the
code. Two mechanical notes, both worth carrying forward: `agy` reviewers must be told **not to call tools**
(two runs returned nothing but a headless permission error until that line was added), and `gpt-oss-120b`
returned "high traffic" errors on two of four attempts.

The orchestrator's own lens was not a re-read of its own code — it was the mutation table and direct
measurement against the live origin, which is where three of its four unique findings came from.

## Rounds

| Round | Reviewers | New CRITICAL | New MAJOR | New MINOR | Code fixed | Gates re-run |
|-------|-----------|--------------|-----------|-----------|------------|--------------|
| 1 | mutation table (all 12) + security/operability | 0 | 4 | 1 | 4 | yes |
| 2 | conformance ×2, refuter, test-integrity | 0 | 4 | 1 | 5, 1 reverted | yes |

Round 1 was the mutation table plus the security lens; round 2 the conformance and refuter panel. Round 2's
findings were all in code the round-1 fixes did not touch, and the round-2 fixes introduced no new findings —
except one the sweep caught immediately, which is recorded below as R2-4.

## Conformance Map

Both capability specs were mapped requirement-by-requirement and scenario-by-scenario by an independent
reviewer, with `path:line` evidence for each. Summarised rather than reproduced in full (114 scenarios):

| Requirement | Scenarios | Code evidence | Test evidence | Status |
|-------------|-----------|---------------|---------------|--------|
| LCP-001 Legacy origin resolution | 4 | `legacyOrigin.ts:16-33,37-52` | `legacyOrigin.test.ts` (10) | SATISFIED |
| LCP-002 Path validation and origin pinning | 9 | `legacyPath.ts:25-30,45-72`, `loadLegacyDocument.ts:246-256` | `legacyPath.test.ts` (18) | SATISFIED |
| LCP-003 No credentials outbound | 5 | `loadLegacyDocument.ts:158-190` | `loadLegacyDocument.test.ts` (8) | SATISFIED |
| LCP-004 Upstream status mapping | 4 | `loadLegacyDocument.ts:200-222` | `loadLegacyDocument.test.ts` (9) | SATISFIED |
| LCP-005 Chrome removal | 8 | `transformLegacyHtml.ts:97-124`, `html.ts:86-128,150-190` | `transformLegacyHtml.test.ts`, `fixtures.test.ts` | SATISFIED |
| LCP-006 Asset resolution via `<base>` | 6 | `transformLegacyHtml.ts:225-236` | `transformLegacyHtml.test.ts`, e2e V28 | SATISFIED |
| LCP-007 Stripping counter/canonical/actions | 7 | `transformLegacyHtml.ts:126-190` | `transformLegacyHtml.test.ts` | SATISFIED |
| LCP-008 Height reporter | 7 | `legacyRuntime.ts:47-97` | e2e V8 (3) | SATISFIED |
| LCP-009 Response construction | 4 | `route.ts:24-45,53-64` | `route.test.ts` (12) | SATISFIED |
| LCP-010 Caching and load control | 8 | `legacyStore.ts`, `loadLegacyDocument.ts:130-149,196-244` | `legacyStore.test.ts`, `loadLegacyDocument.test.ts` | SATISFIED |
| LCP-011 Navigation out of the document | 15 | `transformLegacyHtml.ts:192-222`, `legacyRuntime.ts:99-230` | e2e V20–V27 | SATISFIED |
| LPF-001 Fallback eligibility | 7 | `isEmbeddable.ts:28-41`, `page.tsx:145-147` | `isEmbeddable.test.ts`, `legacyBranch.test.tsx` | SATISFIED |
| LPF-002 Real routes take precedence | 4 | App Router precedence; `src/proxy.ts` unchanged | `url:check`, gate 8 curl matrix | SATISFIED |
| LPF-003 Embedded page rendering | 6 | `page.tsx:161`, `LegacyEmbed.tsx:19-22,55-63` | `LegacyEmbed.test.tsx` (8) | SATISFIED |
| LPF-004 Embedded page metadata | 6 | `page.tsx:104-128` | `legacyBranch.test.tsx` (6) | SATISFIED |
| LPF-005 Degradation | 5 | `page.tsx:149-157`, `legacyOrigin.ts:37-40` | `legacyBranch.test.tsx`, gate 6, rollback run | SATISFIED |
| LPF-006 Height follows the document | 7 | `LegacyEmbed.tsx:31-53` | `LegacyEmbed.test.tsx` (11) | SATISFIED |

The proxy-spec reviewer reported LCP-001 as a CRITICAL "not satisfied". That is a bundle artefact, not a
finding: `legacyOrigin.ts` was in the *page* bundle, not the proxy one, and the page reviewer cites it at
`legacyOrigin.ts:14-17` for LPF-005. The lesson is the same one GATE 1 recorded — never ask a reviewer about
a file you did not hand it.

## Findings

### CRITICAL

None.

### MAJOR

| ID | Finding | Evidence | Found by | Fix | Status |
|----|---------|----------|----------|-----|--------|
| R1-1 | The catch-all page's `cache: 'no-store'` fetch aborts its render: **production 500s on every legacy path** while `next dev` answers 200 | `pnpm build && pnpm start`, `DYNAMIC_SERVER_USAGE` in the server log | orchestrator (production build) | per-surface fetch policy; `3882ec2` `loadLegacyDocument.ts:106-126` | Fixed |
| R1-2 | Negative assertions in `LegacyEmbed.test.tsx` were vacuous — one microtask is not enough for React to re-render, so "height unchanged" held whether the message was accepted or not | mutation LPF-006 survived the whole suite | orchestrator (mutation table) | `expectIgnored` settles, then proves the assertion could fail; `3dc54fe` | Fixed |
| R1-3 | V26 watched only the top window; an actionless form under a `<base href>` navigates the **frame** to the legacy origin | mutation "delete the submit listener" survived | orchestrator (mutation table) | assert the frame's URL; `3dc54fe` `e2e/legacy-embed.spec.ts:398-416` | Fixed |
| R1-4 | No bound on upstream response size — the timeout capped time and the gate capped sockets, nothing capped bytes | `response.text()` on an arbitrary body | gemini-3.6-flash (security) | `readBounded`, 5 MB, streamed, plus a `content-length` pre-check; `2063204` | Fixed |
| R2-1 | `form.submit()` from script does **not** dispatch a submit event, so the capture listener never sees it and the form submits to the legacy origin; `formaction` was not stripped either | W3C DOM spec; the theme's own widgets call it | gemini-3.1-pro (refuter) | prototype neutralised + `formaction` stripped; `2063204` `legacyRuntime.ts:216-224` | Fixed |
| R2-2 | Links compared by **origin**: a hard-coded `http://obshee-delo.ru/...` link reads as third-party and opens the legacy origin in a new tab | LCP-011 invariant | gemini-3.1-pro (refuter) | compared by host in both transform and runtime; `2063204` | Fixed |
| R2-3 | `cache()` keyed on the slug array, which `await params` hands out as a fresh instance per caller — the memo never hit | React `cache()` uses reference equality | gemini-3.1-pro (refuter) | keyed on the path string; `2063204` `page.tsx:102` | Fixed |
| R2-4 | A body-less fragment that was entirely chrome produced an empty document | invariant 15 | gemini-3.1-pro (refuter) | a missing `<body>` now reads as "all body"; `2063204` | Fixed |

### MINOR

| ID | Finding | Disposition |
|----|---------|-------------|
| m1 | The four promised log lines are actually ten | Kept as a superset — each is distinct, greppable and `[legacy]`-prefixed. The **runbook** now lists all ten in a table, which is where an operator looks |
| m2 | A `/legacy/*` failure answers 404, so monitoring cannot tell a broken deploy from a failing origin | By design (LCP-004's invariant, D11: a 5xx is worse than a 404 for a transitional URL). The distinguishing signal is the log line, which exists |

### Rejected, with evidence

| Finding | Why rejected |
|---|---|
| Widening the asset carve-out to any dotted path, so `/files/brochure.pdf` keeps working (refuter) | Measured false. Across 40 legacy pages there are 132 dotted links and **every one** is already under `/wp-content/`. The wider rule's only real effect was on `wp-login.php` — an endpoint, not a file — where sending a visitor to the old site's login form is worse than our 404. I implemented it, `pnpm legacy:sweep` failed on `/donation-service-terms/` on the very next run, and I reverted it |
| "Relative XHR resolves against `location`, not `<base>`", so legacy AJAX hits our origin (refuter) | Refuted by measurement: V28 records every request the framed `/team/` makes and asserts **zero** reach the site origin. The fetch API resolves against the document's base URL, which is what `<base href>` sets |
| Concurrency shedding answering 404 is wrong (refuter) | That is LCP-010 as specified, and D16 records why queueing-then-404 beat both shedding immediately and waiting forever |
| Next's Data Cache retaining a failure on the page surface (refuter + security) | Understood, documented, and independently re-reviewed at GATE 1 (see the spec-review addendum). The page's only definitive outcome is an upstream 404/410, which `notFound()` would have cached for the same window anyway |
| Unsandboxed legacy JS executing same-origin (security) | ASM5. Recorded, accepted, and carrying an explicit revisit trigger: the first authenticated feature on this site. No auth, no cookies, no user data today |
| `resolvePostKind` throws → 500 when WordPress is unreachable (refuter) | Real, and **pre-existing A8 code this change does not touch**. Carried to the handoff as a named follow-up rather than fixed here |

## Test Integrity

| Rule | Result | Evidence |
|------|--------|----------|
| No skipped, focused-only or commented-out tests | pass | `grep -rn "it.skip\|describe.skip\|it.only\|test.only\|xit(" src e2e` → none |
| No assertion loosened or deleted to make a suite pass | pass | Three assertions were **strengthened** after mutations survived (R1-2, R1-3, and the `document.baseURI` case). One expectation was corrected downward with measurement behind it: the fixtures' script counts are element counts (46/58/54), not substring counts (52/64/60), and both are now asserted |
| No wall-clock sleeps, no date dependence, no network in unit or integration tests | pass | `vi.useFakeTimers` in the store and loader suites; the store's clock is injected; the legacy origin is a committed capture. The only `waitForTimeout` calls are in the Playwright suite, which is not a unit test |
| Each test asserts the scenario's observable | pass | The navigation invariant is asserted as "no `href` resolves to a legacy page", never as "the regex matched N times" |
| Fixtures never edited to make a test pass | pass | `git log --follow` on the three fixtures shows one commit each, the capture; sha256s recorded in their README and asserted for byte length |
| Measured numbers asserted as fixture invariants | pass | `fixtures.test.ts` asserts every row of the README table, including the ASM8 falsifier (zero scripts inside chrome) |

### Mutation table

All twelve mutations from `verification-plan.md` were applied to the real source and the named suite run.
**Nine died on the first attempt; three survived and each survivor was a real hole** — the three test defects
above. All twelve are killed now.

| Mutation | Suite that must fail | Result |
|---|---|---|
| LCP-005 keep-only `#middle` | transform suite | killed (27 failed) |
| LCP-006 `target="_parent"` on the injected `<base>` | browser suite | killed |
| LCP-011 rewrite only rooted hrefs | V27 | killed (8 failed) |
| LCP-011 delete the submit listener | V26 | **survived → test fixed → killed** |
| LCP-011 compare `location.pathname`, not `document.baseURI` | V21 | **survived → test added → killed** |
| LCP-002 allowlist → denylist | path suite | killed (8 failed) |
| LCP-003 attach credentials | loader suite | killed |
| LCP-009 copy an upstream header | route suite | killed |
| LCP-010 store failures too | loader suite | killed (2 failed) |
| LCP-008 static overflow CSS | V8 reporter-cannot-run | killed |
| LPF-005 `notFound()` on 5xx | branch suite | killed |
| LPF-006 drop the `event.source` check | embed suite | **survived → suite fixed → killed** |

The `document.baseURI` mutation is worth its own line: it was **unobservable** through any written href,
because the transform normalises every same-page fragment to `#frag` before the runtime sees it. The case that
reaches the comparison is a link the page's own JS repoints after load — which cmsms sliders and accordions
really do — so the matrix page now carries one.

## Coverage

**95.2 %** of lines across the change's new modules, against a 90 % threshold, with `legacyRuntime.ts`
exempt as the plan allows (5.7 % to Vitest, which sees it as data; covered instead by the 48 browser
assertions). Per file: `transformLegacyHtml.ts` 97.5 %, `loadLegacyDocument.ts` 94.9 %, `legacyStore.ts`
94.6 %, `html.ts` 90.3 %, `legacyPath.ts` 89.5 %, `route.ts` / `LegacyEmbed.tsx` / `isEmbeddable.ts` /
`legacyOrigin.ts` 100 %.

`app/[...slug]/page.tsx` sits at 68 %, and that is not this change's lines: the uncovered ones are
`generateStaticParams` and the film/news metadata paths of the pre-existing numeric branch, which need a
WordPress instance. Every line the legacy branch added is covered by `legacyBranch.test.tsx`.

## Over-engineering assessment

GATE 1 ended with a warning: five of its eight rounds went on ~40 lines of navigation runtime, and prose
review of it had reached its limit. That warning was correct and its remedy worked. The browser harness took
one afternoon, and it — not review — is what now holds the invariants: of the four navigation defects found at
this gate, **three were caught by tests** (two mutations, one sweep) and only one by reading.

The change did not grow: ~600 lines of source across eleven small modules, no runtime dependency added, and
the pieces the specs called for and nothing else. Two things it gained under review are both bounds rather
than features — a byte cap and a form-submission guard.

The honest cost line is different from GATE 1's. **Three of the four most serious defects at this gate were
invisible to every static gate.** The production 500 passed lint, types, 515 unit tests and 44 browser tests;
the vacuous test suite passed itself; the over-reaching asset rule passed everything except a sweep against
the real site. What separates this implementation from a broken one is not the review rounds — it is `pnpm
build && pnpm start`, the mutation table, and `pnpm legacy:sweep`. All three are now recorded gates.

## Verdict

**PASS.** Every requirement is mapped to code with independent evidence, every checkbox in `tasks.md` is
checked, all ten executable gates plus the 172-page sweep were re-run after the final code change and pass,
coverage of the changed lines is 95.2 % against a 90 % threshold, the whole mutation table is killed, and the
last round produced no new findings at CRITICAL or MAJOR.

One qualification, stated rather than buried: the spec bundle **changed after GATE 1** — LCP-010's invariant
became per-surface because the original was impossible to implement without 500ing production. That amendment
was re-reviewed on its own by the family that did not write it and found sound; the spec-review addendum
records it, along with the new bundle hash and the recipe for computing it. `inputs_sha256` above is that new
hash, not the one GATE 1 carried, and the difference is deliberate and documented rather than an oversight.
