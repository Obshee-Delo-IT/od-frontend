---
gate: spec-review
verdict: PASS
risk_tier: T2
rounds: 8
round_findings: "10,8,4,4,3,1,3,0"
round_criticals: "2,3,1,0,1,0,0,0"
last_round_new_findings: 0
unresolved_critical: 0
unresolved_major: 0
openspec_validate_strict: pass
families: 3
inputs_sha256: "2b2fcc99d4fbff87b8824db7d3990d0a57dff1f2f010f121f7f6fa6663309dd0"
generated_utc: "2026-08-13T16:21:17Z"
---

# GATE 1 - Spec Review

## Panel

Reviewers ran via `agy --mode plan` (read-only, material inlined in the prompt) plus the orchestrator's own
lens. Three families as `reviewers.yaml` requires for T2. The refuter was always Gemini — the family that did
not write the bundle.

| Reviewer | Family | Effort | Lens | Findings | Unique |
|---|---|---|---|---|---|
| orchestrator (Claude Opus 5) | anthropic | medium | completeness | 5 | 3 |
| gemini-3.1-pro-high | google | high | consistency (R1) | 4 | 4 |
| gpt-oss-120b-medium | openai-oss | medium | risk (R1, R3) | 12 | 7 |
| gemini-3.1-pro-high | google | high | **REFUTER** (R2, R3, R5, R6, R7, R8) | 24 | 20 |
| gemini-3.6-flash-high | google | high | simplicity (R2) | 8 | 6 |
| gemini-3.6-flash-high | google | high | feasibility (R3) | 2 | 1 |
| gemini-3.6-flash-high | google | high | consistency (R4–R8) | 17 | 15 |

Every reviewer earned its slot; the refuter earned it several times over. Two runs failed to return —
`gpt-oss` on rounds 2, 4, 6 and 7 (upstream capacity errors) and one Gemini invocation on round 4 (a headless
permission denial). Both lenses were re-run successfully in later rounds, so no lens is missing from the
record, but the openai-oss family is thinner in the tail rounds than the roster intends.

**Honest limitation.** The `research` artifact's lenses were run inline by the orchestrator, not by a
subagent panel — this session runs under a standing instruction not to spawn agents unasked. GATE 1 itself
did get a real multi-family panel via `agy`, which is why it found what the research phase had not.

## Rounds

| Round | Reviewers | New CRITICAL | New MAJOR | New MINOR | Amendments made |
|---|---|---|---|---|---|
| 1 | consistency, risk, refuter, completeness | 2 | 8 | 2 | Extraction inverted to removal-based; `<base>` mechanism adopted; SSRF/credential/header rules; timeout + concurrency; metadata rework |
| 2 | simplicity, refuter, (risk failed) | 3 | 5 | 1 | `<base target>` removed; click/submit routing added; overflow moved into the script; caching restated; poll bounded |
| 3 | refuter, risk, feasibility | 1 | 3 | 3 | Proxy owns its cache; allowlist path validation; `baseURI` anchor comparison; explicit-target correction; scheme guard |
| 4 | consistency, (refuter + risk failed) | 0 | 4 | 2 | Decisions/design/spec realigned on caching, validation, failure modes; assumption IDs renamespaced to `ASM…` |
| 5 | refuter, consistency, risk | 1 | 2 | 2 | Anchor clicks scroll manually; `target="_self"` downloads; `od_embed` query contradiction; D11 split by surface |
| 6 | refuter, consistency, (risk failed) | 0 | 1 | 6 | **Refuter reported NO CRITICAL OR MAJOR.** Every page link now rewritten at transform time, closing the no-JS leak |
| 7 | refuter, consistency, risk | 0 | 3 | 3 | Same-page anchors normalised to fragment-only; D2/LCP-011 wording; `href="#"`; meta-refresh stripped |
| 8 | refuter, consistency | 0 | 0 | 3 | Prototype rewriter scoped to `<a>`/`<area>`; two scenarios added |

**Reading the last row.** Round 8's refuter produced no CRITICAL and no MAJOR against the spec bundle. It did
raise two MAJORs against the **prototype** — a global `\shref=` match that would also rewrite
`<link rel="stylesheet" href="/css/x.css">`, and a missing script/style/comment mask in the probe's depth
counter. In both, the spec was already correct and the probe was not: LCP-011 says *navigational* `href`,
LCP-005 already requires masking. The first was fixed in the probe anyway (it is a real lesson for the
implementer, now also a scenario); the second is left as a documented probe limitation. `last_round_new_findings`
is recorded as 0 on that basis — new findings **against the artifacts under review** — and this paragraph is
here so a reader can audit that judgement rather than take it on trust.

## Findings

### CRITICAL

| ID | Finding | Evidence | Found by | Resolution (artifact amended) | Status |
|---|---|---|---|---|---|
| C1 | Keeping only `#middle` discards every `wp_footer` script, killing the interactivity the iframe exists to preserve | Measured: 40/52 (`/team/`) and 52/64 (`/materials/plakati/`) scripts sit after `</footer>`; **zero** inside any chrome element | consistency, refuter | design D14 → removal-based; LCP-005 rewritten; research L2 gained round 4 | Fixed |
| C2 | In-content clicks render the whole site shell inside the iframe (recursive nesting) | `<a href="/contacts/">` loads our page in the frame | refuter, completeness | LCP-011 + design D17 | Fixed |
| C3 | `<base target="_parent">` sends unrewritten links, fragments, actionless forms and downloads to the **legacy origin in the top window** | The round-1 fix for C2 caused it | refuter | `<base>` carries no target; LCP-006 split from LCP-011 | Fixed |
| C4 | Reliance on Next's caching could persist a 404 for an hour after a one-second blip | Three reviewers gave three incompatible accounts of Next's semantics | refuter, feasibility | design D13 + LCP-010: the proxy owns a bounded success-only store; fetch is `no-store`; route dynamic | Fixed |
| C5 | Fragment links navigate the frame cross-origin — with a cross-origin `<base>`, `#comments` is not a same-document navigation | Identified correctly by `baseURI`, then handed back to the browser | refuter | LCP-011: `preventDefault` + manual `scrollIntoView`; same-page anchors normalised to fragment-only at transform time | Fixed |

### MAJOR

| ID | Finding | Found by | Resolution | Status |
|---|---|---|---|---|
| M1 | `Set-Cookie` and other upstream headers relayed onto our domain | risk | LCP-009: response constructed, never forwarded | Fixed |
| M2 | No fetch timeout — Node `fetch` has none, so a hung origin holds a request open | risk, completeness | D16 + LCP-010 | Fixed |
| M3 | Unbounded upstream concurrency; then, once bounded, shedding 404s at a burst | risk, refuter | D16: queue with a bounded wait, never shed silently | Fixed |
| M4 | A greedy `<script>…mc.yandex.ru…</script>` strip ate 11 of 52 scripts | orchestrator (prototype run) | LCP-005/007: per-element strips only | Fixed |
| M5 | Depth counting miscounts on tag-like text in scripts/comments | refuter | LCP-005 invariant: mask `<script>`/`<style>`/comments | Fixed (spec) |
| M6 | `cache()` cannot span the page request and the iframe request — "one fetch per page view" was unachievable | refuter | LPF-004 restated per surface | Fixed |
| M7 | Static `overflow: hidden` + failed height sync = unreachable content | refuter | LCP-008: the script suppresses scrolling itself | Fixed |
| M8 | Transient 5xx cached as a 404 page for the ISR window | risk, refuter | LPF-005: only a definitive 404/410 calls `notFound()` | Fixed |
| M9 | Rewriting only rooted `href`s leaves document-relative links reaching the legacy origin with scripting off | consistency | LCP-011: every page link resolved and rewritten at transform time | Fixed |
| M10 | Anchor comparison against `location.pathname` (which carries `/legacy/`) never matches | refuter | LCP-011: compare `document.baseURI` | Fixed |
| M11 | Links with an explicit `target` skipped, opening the legacy origin in a new tab | refuter | LCP-011: correct the destination first, choose the context second | Fixed |
| M12 | Denylist-style path validation misses homoglyphs | risk | LCP-002: positive allowlist | Fixed |
| M13 | `<meta http-equiv="refresh">` navigates the frame off-site | risk | LCP-007 | Fixed |
| M14 | Doc drift after amendments: D13 cache, D6 validation, D2 extraction direction, D11 404-vs-embed, `od_embed` vs "no query", two stale failure-mode rows | consistency (R4, R5, R7) | All realigned | Fixed |
| M15 | `A1`–`A8` assumption IDs collide with the repo's own `A2`/`A6`/`A8` workstream ids | consistency | Renamespaced to `ASM1`–`ASM8`, with the reason recorded | Fixed |

### MINOR

Open, carried to the handoff as deferred work — none blocks implementation:

- **m1** `?tab=1#comments` on the current page rewrites to a site URL and loses the tab state on click. Bounded
  by LCP-002 dropping the iframe's query anyway.
- **m2** The prototype's depth counter does not implement the script/style/comment masking LCP-005 requires.
  The probe is a design artifact, not the implementation; the requirement stands.
- **m3** Unquoted or space-padded `action=`/`href=` attributes need quote-agnostic matching (now a scenario).
- **m4** Queue-timeout answers 404 rather than 503 with `Retry-After`. Declined: the visitor sees an empty
  frame either way, and LCP-004's small status set is worth more than the nuance.
- **m5** A mixed fleet mid-deploy serves some replicas with `WP_LEGACY_BASE` and some without. No atomic
  config rollout exists in Coolify; recorded in design § Data and Migration.
- **m6** ASM5 (legacy scripts same-origin) is accepted, not enforced. It must be revisited before any
  authenticated feature ships; `frame-ancestors 'self'` is the only hardening taken.

**Rejected findings**, with the evidence that rejects them — recorded so they are not re-litigated:

- *"SSRF via double-decoded traversal"* (risk, R7): `%` is rejected by the LCP-002 allowlist, so no `%2e`
  segment ever reaches URL composition. The finding contradicts the requirement it cites.
- *"Cache poisoning via `Accept-Language`/`User-Agent`"* (risk, R7): outbound headers are constructed, not
  forwarded, and the UA is fixed (LCP-003) — the upstream has nothing to vary on.
- *"No submit listener"* (refuter + consistency, R7, CRITICAL): an artifact of the bundle being truncated at
  line 185 for size; the listener is at `build.mjs:188`. Round 8 re-ran with the complete file.
- *"Line numbers do not exist; the file is 83 lines"* (consistency, R6): `src/app/[...slug]/page.tsx` is 99
  lines and the non-numeric branch is at 86–89, as cited.

## Checklist

- [x] `unresolved_critical` = 0 and `unresolved_major` = 0
- [x] Last round produced no new CRITICAL or MAJOR against the artifacts under review (see the Rounds note)
- [x] `openspec validate fallback --strict` exits clean
- [x] design.md Open Questions is empty
- [x] Every requirement has a failure or boundary scenario
- [x] Every capability in proposal.md has a spec file, and every spec file a capability
- [x] Panel met the family minimum (3) and every reviewer had its own lens
- [x] `inputs_sha256` recorded and matches the reviewed bundle

## Over-engineering Assessment

The schema says two consecutive rounds of real CRITICAL/MAJOR findings is evidence the change is wrong-shaped.
Eight rounds ran, and rounds 1–5 each produced them, so this deserves a straight answer rather than a
formality.

**The change is not wrong-shaped; one sub-component of it is hard.** Rounds 1 and 4–8 were dominated by a
single area — how a link, a form or a fragment behaves inside an iframe whose `<base>` points at another
origin. Every fix in that area exposed the next edge case, which is the classic signature of a problem whose
rules live in browser behaviour rather than in the code being reviewed. The rest of the bundle — origin
resolution, path validation, chrome removal, header construction, caching, eligibility, the embed component —
has been finding-free since round 3. Splitting the change would not help: the navigation runtime is 40 lines
that only exist because of the proxy, and the alternatives (SSR injection, a chromeless WP template) were
refuted on measurements in `research`, not on preference.

**What the round count actually demands** is that the navigation runtime stop being reviewed as prose. Each
of C2, C3, C5, M9, M10, M11 and m1 is a one-line assertion in a real browser. The verification plan therefore
makes a Playwright harness over the injected runtime a **required** gate, not an optional extra, and
`tasks.md` sequences it before the catch-all branch is wired up. That converts the loop that consumed this
gate into a test suite that runs in seconds.

Cost noted honestly: five of the eight rounds were spent on ~40 lines of client-side navigation logic. A
future change of this shape should build the browser harness first and review second.

## Verdict

**PASS.** Every CRITICAL and MAJOR is resolved by amendment to the upstream artifacts, the final round's
refuter found nothing at either severity in the spec bundle, `openspec validate --strict` is clean, and the
open MINORs are all either declined with a stated reason or deferred without blocking implementation. The
bundle changed substantially under review — the extraction direction, the URL mechanism, the navigation
model, the cache owner and the failure semantics are all different from the first draft, and each change is
traceable to a specific finding with measured evidence behind it. The one condition attached to this PASS is
recorded above and carried into the plan: the injected navigation runtime must be verified in a browser
before it is trusted, because prose review of it has demonstrably reached its limit.

---

## Addendum — 2026-08-14, one requirement re-reviewed after implementation

Implementation forced one amendment to the bundle this gate passed, so the bundle's hash no longer matches
the `inputs_sha256` in the front matter above. Recorded here rather than silently: **the front-matter hash
belongs to the bundle as reviewed on 2026-08-13**, and the current bundle hashes to
`b54687bc0c9676fddb253d5878ab70ff204ebc5afa5fa9828fbf85bfed664f03`
(`cat proposal.md specs/legacy-content-proxy/spec.md specs/legacy-page-fallback/spec.md design.md
decisions.md research.md | sha256sum`, run from the change directory). The recipe is stated because the
original one was not, and could not be reproduced.

**What changed.** LCP-010's invariant said "Every upstream fetch is made uncached (`cache: 'no-store'`)".
That is impossible on one of the two surfaces: the catch-all page's `revalidate` is module-level and shared
with the numeric-post branch, so its render must stay statically generatable, and an uncached fetch inside it
aborts with `DYNAMIC_SERVER_USAGE` — **HTTP 500** in a production build, where `next dev` answers 200.
`connection()` does not rescue it. The invariant is now per-surface: the proxy route keeps `no-store`, the
page fetches with `next: { revalidate }`. `verification-plan.md` gained gate 10 (production build + smoke),
the only gate that can catch this class.

**Re-review.** The amended text plus the requirements it could contradict (LCP-004, LPF-004, LPF-005) and the
added gate were put to `gemini-3.1-pro-high` through the consistency lens — the family that did not write the
amendment — with the question stated in the sharpest form available: can a retained failure on the page
surface produce a wrong 404, a wrong 200, or stale content a visitor sees, rather than only a generic
`<title>`? Verdict: **"The amendment is sound."** No findings at any severity.

This addendum does not re-open the rest of the bundle, which is unchanged.
