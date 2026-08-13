---
risk_tier: T2
escalated_questions: 2
---

# Decisions

## Risk Tier

**T2.** It crosses a module boundary and introduces the app's first server-side fetch of a remote HTML
document that is then returned from our own origin — a new internal contract (`/legacy/*`) plus a new
security property (third-party script executing same-origin). It is not T3: nothing is irreversible, there
is no data migration, no money, no auth and no PII; the whole feature retires itself page by page as native
routes land, and unsetting `WP_LEGACY_BASE` returns the site to today's behaviour.

## Decision Ledger

### D1 What origin does the fallback fetch from, given the frozen copy does not exist yet?

- **Options considered:**
  1. Live production `https://obshee-delo.ru` now, frozen copy later by env swap.
  2. `od-dev.tmweb.ru` — the only host with REST on, and the only one with ssh access.
  3. Block the change until the frozen copy is stood up (what `docs/legacy-page-fallback.md:93` calls
     "the blocking one").
- **Chosen:** (1). od-dev is a *migrated-to-Gutenberg* copy — 0 cmsms shortcodes where prod has 34–90
  (`docs/legacy-page-fallback.md` §2 table) — so embedding it would not reproduce the old look and fidelity
  could not be validated at all. Live prod is reachable and serves the exact welfare + cmsms markup we intend
  to embed (measured: HTTP/2 200, 30 stylesheets, 52 scripts on `/team/`, 159 `cmsms_row` on `/materials/plakati/`).
  Since the only difference between prod and the frozen copy is the hostname, the switch is one env var and
  no code. (3) would trade a shippable mechanism for a scheduling dependency we do not control.
- **Evidence:** research L7 (legacy origin reachable, env read at module load), L3 (REST 404 on prod),
  `docs/legacy-page-fallback.md:22,93`, `README.md:21`.
- **Reversibility:** two-way door (one env var).
- **Blast radius:** service.
- **Confidence:** high. **Escalated — answered by the user this session.**

### D2 How does the proxy reduce a legacy page to "inner content only"?

- **Options considered:**
  1. Proxy-side extraction: reduce the document to its inner content by working from the theme's own
     landmarks, and honour a chromeless render mode if the origin offers one. (*Which* direction — keep
     `#middle`, or remove the chrome — is an implementation decision settled in design D14, which measurement
     later forced to removal.)
  2. Require a chromeless WP page template on the origin and trust its output.
- **Chosen:** (1). (2) cannot be validated at all until someone writes and deploys WP-side code on a host
  that does not exist yet, and it is not even available on the origin D1 selects. Extraction is verifiable
  today: the boundary was measured as exactly one `#header`, one `#middle`, one `#bottom` and one `#footer`
  on **seven** differently-shaped pages (`/team/`, `/rekvizit/`, `/materials/printed-products/`, `/projects/`,
  `/conf_politics/`, `/faq/`, `/materials/plakati/`; 68–128 KB each). The chromeless template stays a later
  optimisation, not a prerequisite.
- **Evidence:** research L2 (measured DOM contract), L3.
- **Reversibility:** two-way door — if a chromeless template later lands, extraction becomes a no-op branch.
- **Blast radius:** module.
- **Confidence:** high. **Escalated — answered by the user this session.**

### D3 What query parameter requests chromeless mode?

- **Options considered:**
  1. `?embed=1`, as `docs/legacy-page-fallback.md:31,37` specifies.
  2. A namespaced parameter, e.g. `?od_embed=1`.
  3. No parameter at all — always extract.
- **Chosen:** (2), with extraction as the unconditional safety net (D2). `?embed=1` is **reserved by
  WordPress core**: measured, `/team/?embed=1` returns 21 685 bytes of the oEmbed *card* template
  (`div.wp-embed`, excerpt, share dialog, zero `cmsms_row`) instead of the 85 641-byte page. Shipping the
  documented parameter would have served an excerpt card on every fallback page and looked like a content
  bug, not a routing bug. A namespaced parameter is inert on a host that does not implement it, which is
  exactly the behaviour we want during the window before the frozen copy exists.
- **Evidence:** research L3 (measured byte counts and DOM of the `?embed=1` response).
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** high. This overturns the design doc; `docs/legacy-page-fallback.md` must be amended.

### D4 Where does the embed render, and does it stay inside `Container`?

- **Options considered:**
  1. Page renders `<Header/>` + embed + `<Footer/>`, per `docs/legacy-page-fallback.md:43-46`.
  2. Page renders the embed only; the root layout supplies the shell.
- **Chosen:** (2). `src/app/layout.tsx:59-67` already wraps every route in `HeaderServer` / `Container` /
  `Footer`, so (1) would render the header and footer twice. The embed stays **inside** `Container` for this
  change: legacy pages are full-bleed (`section.content_wrap.fullwidth`) and will therefore sit narrower
  than they do on the old site, which is a cosmetic regression on a transitional page and is preferable to
  teaching the layout a full-bleed escape hatch that nothing else needs yet. Recorded as a known cosmetic
  compromise, not an oversight.
- **Evidence:** research L1 (layout + `Container` clamps), L2 (`fullwidth` measured).
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** medium on the `Container` half — if the sample pages look visibly broken rather than merely
  narrow, escaping `Container` is the follow-up.

### D5 How is the fetched HTML transformed — DOM parser or string rewriter?

- **Options considered:**
  1. Add a server-side DOM library (cheerio / parse5 / promote `jsdom` to a dependency).
  2. A pure string rewriter built from scoped regexes, unit-tested against a captured fixture.
- **Chosen:** (2). The repo already rewrites WordPress HTML this way and tests it as a pure function —
  `src/modules/News/utils/resolveContentImages.ts` with `resolveContentImages.test.ts`, plus
  `absolutizeWpMedia`, `imageUrl`. `jsdom` is a dev dependency for Vitest and promoting it to runtime for one
  route is a large dependency for a narrow job; `html-react-parser` produces React nodes, not HTML. The
  input is a single known theme's markup, not the open web.
- **Evidence:** research L5 (prior art), Constraint 11.
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** medium — regex HTML handling is a classic footgun; mitigated by anchoring on the measured
  `id="…"` boundaries and by fixture tests over real captured pages.

### D6 How is the `/legacy/[...slug]` route hardened against SSRF and credential leakage?

- **Options considered:**
  1. Compose `${WP_LEGACY_BASE}/${slug.join('/')}/` and fetch.
  2. Validate every segment against a conservative character class, reject `.`/`..`, build the URL with the
     `URL` constructor, assert the resulting origin equals the configured origin, fetch with plain `fetch`,
     and do not follow cross-origin redirects.
- **Chosen:** (2). This is the app's first route that turns user input into a server-side URL — there is no
  existing pattern to inherit (`src/app/health/route.ts` is static). Two concrete leaks (2) closes:
  `wpFetch` would attach `Authorization: Basic …` built from the WordPress application password
  (`src/shared/api/httpClient.ts:45-58`) to a *different* origin, and a segment containing `@`, `:`, a
  backslash or a scheme could move the fetch off the intended host.
- **Evidence:** research L8.
- **Reversibility:** two-way door, but a miss here is a live vulnerability — treat as one-way in review.
- **Blast radius:** service.
- **Confidence:** high.

### D7 Where does metadata for an embedded page come from?

- **Options considered:**
  1. `wp-json` on the legacy origin.
  2. Parse `<title>` and `<meta name="description">` out of the same fetched HTML, reusing one `cache()`d
     fetch across `generateMetadata` and the page.
  3. Leave `generateMetadata` returning `{}`.
- **Chosen:** (2). (1) is impossible on the selected origin — `GET /wp-json/wp/v2/pages?per_page=1` measured
  **404**. (3) would leave ~170 pages titled "ОБЩЕЕ ДЕЛО" with no canonical. `<title>` and
  `<link rel="canonical">` are present in the legacy HTML (measured); `<meta name="description">` was absent
  on `/team/`, so description is best-effort. The canonical we emit is **ours**
  (`canonicalUrl(path)`), never the legacy origin's — after cutover the legacy origin is the frozen copy and
  pointing at it would canonicalise the whole site onto a private host.
- **Evidence:** research L3, L4, `src/shared/config/site.ts:29-41`, `src/app/[...slug]/page.tsx:65-81`.
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** high.

### D8 What is the indexing posture of the two URLs (parent page vs `/legacy/*` twin)?

- **Options considered:**
  1. Both indexable.
  2. Parent indexable and self-canonical; `/legacy/*` responses carry `X-Robots-Tag: noindex`, and the
     legacy `<link rel="canonical">` / `og:url` are stripped from the proxied HTML.
  3. `noindex` on both — treat fallback pages as invisible until redesigned.
- **Chosen:** (2). (1) creates a second address for every page — the exact failure the A8 work exists to
  prevent — and the `/legacy` twin is a chromeless fragment, the worse of the two to rank. (3) would
  discard the ~15 % of entry traffic these pages currently earn, which is the whole point of the fallback.
  The parent page keeps the live URL and its own canonical; the proxy twin is excluded.
- **Evidence:** research L4 (sitemap has no pages), L8 (legacy canonical points at the legacy origin),
  `docs/legacy-page-fallback.md` §4 SEO row.
- **Reversibility:** two-way door.
- **Blast radius:** product (search visibility).
- **Confidence:** medium — iframe content not being in the parent DOM is an accepted, already-priced trade
  (`docs/implementation-plan.md:41`).

### D9 What gets stripped from the proxied HTML beyond the chrome?

- **Options considered:**
  1. Strip chrome only.
  2. Also strip the Yandex Metrica counter, the legacy `<link rel="canonical">` / `og:url` / `<base>`, and
     neutralise the legacy search form's cross-origin `action`.
- **Chosen:** (2). Measured, `/team/` embeds `mc.yandex.ru` twice — proxying it as-is silently double-counts
  every fallback pageview into the *old* site's counter, corrupting the one dataset the whole launch
  tiering is argued from (`docs/implementation-plan.md:41`, `scripts/check-legacy-urls.mjs:30-35`). The
  legacy canonical is handled per D7. The search form posts to the legacy origin, which after cutover is a
  private host.
- **Evidence:** research L8 (Metrica, canonical), L4 (search form action).
- **Reversibility:** two-way door.
- **Blast radius:** product (analytics correctness).
- **Confidence:** high.

### D10 How is the iframe height synchronised?

- **Options considered:**
  1. Fixed `height: 100vh` with inner scrolling.
  2. Injected script in the proxied document posts its `scrollHeight` on load and on `ResizeObserver` /
     mutation; the parent client component listens and sets the iframe height.
  3. Parent reads `iframe.contentDocument.body.scrollHeight` directly (legal, since same-origin).
- **Chosen:** (2), with the parent validating `event.origin === window.location.origin` and ignoring any
  other message. (1) produces a nested scrollbar on 68–128 KB pages, which reads as broken. (3) works but
  couples the parent to the child's load timing and needs polling to catch late layout (web fonts, the 30
  legacy stylesheets, cmsms sliders); the injected observer is push-based and is what the design doc already
  specifies.
- **Evidence:** research L2 (page sizes), `docs/legacy-page-fallback.md` §4 height row.
- **Reversibility:** two-way door.
- **Blast radius:** function.
- **Confidence:** high.

### D11 What happens when `WP_LEGACY_BASE` is unset, or the origin errors?

- **Options considered:**
  1. Throw — a misconfigured deploy fails loudly.
  2. Warn once at module load; `/legacy/*` answers 404; the catch-all `notFound()`s exactly as it does today.
- **Chosen:** (2). CI runs lint → type-check → test → build with **no** WP env at all and
  `src/shared/api/httpClient.ts:5-17` establishes precisely this warn-and-stub pattern; throwing would break
  the build. It also makes rollback a config change: unset the variable and the site is back to today's
  behaviour. The two surfaces then answer a failing origin **differently**, on purpose:
  - **`/legacy/*` (the proxy)** answers 404 for every failure — upstream 404/410, 5xx, timeout, rejected path
    — always with `Cache-Control: no-store` and a `console.warn`. A 500 is worse than a 404 for a
    transitional URL, and nothing about the failure is stored (D13).
  - **the page (catch-all branch)** `notFound()`s only on a **definitive** upstream 404/410. On a transient
    5xx or timeout it still renders the embed, because a `notFound()` under the shared `revalidate = 3600`
    would be cached — freezing a one-second blip into an hour of 404s (LPF-005). The iframe then fetches
    independently and fills in as soon as the origin recovers.
- **Evidence:** research L3 (upstream 404 is real), L7 (rollback shape, per-replica ISR).
- **Reversibility:** two-way door.
- **Blast radius:** service.
- **Confidence:** high.

### D12 Which paths does the fallback claim?

- **Options considered:**
  1. Every non-numeric path the catch-all sees.
  2. (1) minus a denylist, minus a reserved-prefix guard (`legacy`, `_next`, `api`, anything with a dot in
     the last segment), and only for `slug.length` within a sane bound.
- **Chosen:** (2). Real routes already win by App Router precedence, so the guard is not about them — it is
  about not embedding a request for `/favicon.png` or `/legacy/…` recursively through the proxy. The denylist
  ships **empty** with its mechanism in place (research U2): the retired-page list is a content decision, and
  an empty list means today's behaviour for zero pages rather than a guess about which slugs are dead.
- **Evidence:** research L1 (route inventory, proxy matcher), U2.
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** high.

### D13 How is the proxy response cached, given the catch-all's `revalidate` is shared?

- **Options considered:**
  1. Rely on the catch-all's `revalidate = 3600`.
  2. Give the route handler its own `revalidate` and cache the upstream `fetch` with
     `next: { revalidate: 3600 }` — i.e. let Next's caching layers do it.
  3. Cache in a store the proxy owns: a bounded, in-process, success-only map from path to transformed
     document, with every upstream fetch made `cache: 'no-store'` and the route left dynamic.
- **Chosen:** (3). (1) is unavailable — the catch-all's segment config is module-level and shared with the
  `/<id>` post branch that carries 46 % of site entries (`src/app/[...slug]/page.tsx:25-26`), and the iframe
  document is a separate browser request anyway. (2) was the original choice and did not survive review:
  three independent reviewers made three mutually incompatible claims about Next's behaviour — that an
  upstream `Set-Cookie`/`no-cache` defeats the Data Cache, that a route-segment `revalidate` persists a 404
  for the full hour, that the Data Cache itself persists a failed response — and none cited a source. Rather
  than adjudicate framework internals that move between minor versions, the proxy owns the store, which makes
  every property in LCP-010 directly testable. Note it is per-replica and dies on redeploy, exactly like the
  ISR cache (research L7): a load reducer, not a durability guarantee.
- **Evidence:** research L2 (shared segment config), L3 (`max-age=0` upstream), L7; design D13 for the
  resulting shape.
- **Reversibility:** two-way door.
- **Blast radius:** module.
- **Confidence:** high on the property, deliberately agnostic on the framework mechanism.

## Assumption Ledger

Assumption IDs are `ASM…`, not `A…`: this repo already uses `A2`, `A6`, `A8` as **workstream** ids throughout
`docs/` and in `src/app/[...slug]/page.tsx` itself, so an `A6` here would read as the legacy-fallback
workstream — which is exactly what this change is. Ordered by first appearance in the decisions above, so
`ASM8` sits next to the decision it supports.

| ID | Assumption (falsifiable sentence) | Why reasonable | Cheapest falsifier | If wrong |
|----|-----------------------------------|----------------|--------------------|----------|
| ASM1 | Every one of the ~174 legacy pages has exactly one `<section id="middle">`, and the page's content lives entirely inside it. | Measured true on 7 pages spanning the shapes that matter (team/profiles, legal text, materials grid, programmes, FAQ accordion, the 159-block poster page). The markup comes from one theme template, not per-page HTML. | Run the transform over all 174 URLs and count boundary-miss warnings — a scripted check, minutes. | **Nothing, after design D14.** The transform removes the three chrome elements rather than keeping `#middle`, so the boundary is a warning signal, not the cut. A page without `#middle` still renders. |
| ASM8 | The three chrome elements (`header#header`, `section#bottom`, `footer#footer`) contain no `wp_footer` scripts, so removing them keeps every interactive bootstrap. | Measured: **zero** of 52 (`/team/`) and 64 (`/materials/plakati/`) script tags sit inside any chrome element; 40 and 52 respectively sit *after* `</footer>`. | The fixture test that asserts no external script src is lost by the transform — it fails the moment a page violates this. | Interactive widgets die on the affected page, i.e. the exact capability the iframe exists to preserve. Detected by the fixture test rather than in production. |
| ASM2 | Dropping `#header`, `#bottom` and `#footer` markup does not break in-content behaviour. | The ~52 scripts are enqueued via `wp_head`/`wp_footer` and are all retained; only chrome *markup* is removed. Theme JS that queries a missing `#header` typically no-ops. | Eyeball the 5-page sample with the console open; look for uncaught TypeErrors. | Sliders/toggles silently fail on some pages. Falls back to keeping `#footer` markup hidden with CSS instead of removed. |
| ASM3 | `https://obshee-delo.ru` stays reachable server-side from dev and from the deployed container. | Measured reachable today; it is the current production site and will keep serving until cutover. | `curl` from inside the container once A2 lands (research U6). | The fallback 404s everything in that environment. D11 makes that a graceful 404, not a 500. |
| ASM4 | Iframe-weakened SEO on these pages is acceptable for the transition window. | Already measured and priced: ~15 % of entries, on pages actively being replaced, and the four highest-value ones are getting native routes instead (`docs/legacy-page-fallback.md:93`). | Watch Yandex Webmaster for the fallback URLs over the first weeks after cutover. | Ranking loss on ~170 low-traffic pages; recoverable by prioritising native routes. |
| ASM5 | Executing legacy theme scripts same-origin is acceptable. | The new site has no auth, no cookies and no user data to steal, and the HTML comes from an origin we own. | A future feature adds a session cookie — then this becomes a real finding. | Legacy scripts gain read access to a session. Revisit before any authenticated feature ships; noted in the design's security section. |
| ASM6 | Stripping the legacy Metrica counter does not lose data anyone depends on. | The new site will carry its own counter; double-counting is the actual risk (D9). | Ask whoever reads the dashboards (research U5). | A gap in old-counter continuity for fallback pages. Reversible in one line. |
| ASM7 | Embedded pages stay out of `sitemap.xml`. | That is today's behaviour (`src/app/sitemap.ts:172-196` lists no pages), and listing a URL whose content is not in its DOM invites a thin-content assessment. | SEO review decides a fallback page must be discoverable. | Slower discovery of ~170 low-traffic URLs that are already linked from the header nav. |

## Escalation Analysis

| Candidate | Trigger matched | Escalated? | Resolution |
|-----------|-----------------|------------|------------|
| Which origin to fetch from (D1) | (d) low confidence + service blast radius; depends on infrastructure the repo cannot answer | **Yes** | Live prod now, env swap to the frozen copy later. |
| Chromeless strategy (D2) | (d) — the alternative blocks the entire change on WP-side work | **Yes** | Proxy-side extraction. |
| Same-origin execution of legacy scripts (ASM5, D6) | (c) security posture | No | Repo-answerable: no auth, no cookies, no PII today. Recorded as ASM5 with an explicit revisit trigger. |
| `noindex` posture for the two URLs (D8) | (b) externally visible | No | The trade is already decided and quantified in the docs; D8 only picks which of the two URLs carries it — the conservative choice. |
| Retired-page denylist (D12) | none | No | Ships empty with the mechanism in place; a content decision, not a code one. |
| Stripping the legacy Metrica counter (D9) | (b)-adjacent (analytics) | No | Strictly safer and one line to revert; recorded as ASM6. |
| `Container` width clamp on embeds (D4) | none | No | Cosmetic, two-way door, follow-up named. |
| Sitemap listing (ASM7) | none | No | Keeps today's behaviour. |

## Human Input

| # | Question | Recommended default | Answer received | Taken |
|---|----------|---------------------|-----------------|-------|
| 1 | What should `WP_LEGACY_BASE` point at for this implementation? | Live prod `https://obshee-delo.ru`, swap to the frozen copy later by env alone | "Live prod, swap later" | Default (D1) |
| 2 | How should the proxy get "inner content only" out of a legacy page? | Proxy-side extraction, honouring a chromeless parameter when the host offers one | "Proxy-side extraction, ?embed=1 when present" | Default (D2) — with the parameter **renamed** to `?od_embed=1`, because measurement afterwards showed `?embed=1` is WordPress core's oEmbed card switch (D3). The user's intent (honour a chromeless mode if present, extract otherwise) is preserved; only the parameter name changed. |
