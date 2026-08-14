## ADDED Requirements

### Requirement: Legacy origin resolution

The system SHALL read the legacy WordPress origin from `WP_LEGACY_BASE` at module load, normalise it to an
origin with no trailing slash, and treat an absent, empty or unparseable value as "the fallback is disabled"
— warning once on the server and never throwing.

**ID**: LCP-001

**Invariants**: The configured value is only ever consumed as an origin — scheme + host + optional port; any
path, query or fragment in it is discarded. A disabled fallback never produces a 5xx.

#### Scenario: Configured origin
- **WHEN** `WP_LEGACY_BASE=https://obshee-delo.ru`
- **THEN** the resolved origin is `https://obshee-delo.ru`
- **AND** no warning is logged

#### Scenario: Trailing slash and stray path are normalised
- **WHEN** `WP_LEGACY_BASE=https://obshee-delo.ru/some/path/`
- **THEN** the resolved origin is `https://obshee-delo.ru`

#### Scenario: Absent configuration disables the fallback
- **WHEN** `WP_LEGACY_BASE` is unset (the CI build, per `src/shared/api/httpClient.ts:5-17`)
- **THEN** the resolved origin is `null`
- **AND** exactly one warning is logged at module load
- **AND** importing the module does not throw

#### Scenario: Unparseable configuration is treated as absent
- **WHEN** `WP_LEGACY_BASE=not a url`
- **THEN** the resolved origin is `null`
- **AND** a warning names the variable

### Requirement: Legacy path validation and origin pinning

The system SHALL reject any requested legacy path before fetching unless every decoded segment matches a
conservative allowlist, SHALL discard the incoming query string, and SHALL assert that the composed URL's
origin equals the configured origin — returning 404 when any check fails.

**ID**: LCP-002

**Invariants**: A request never causes an outbound fetch to any origin other than the configured one.
Validation is an **allowlist, not a denylist**: a segment may contain only Unicode letters, Unicode digits,
`-`, `_`, `.` and `~`, and may not be empty, `.` or `..`. Everything else — `/`, `\`, `:`, `@`, `?`, `#`, `%`,
control characters, and any homoglyph nobody thought to enumerate — is rejected by not being on the list. Each
segment is decoded **exactly once** before it meets that list, which is what keeps the guarantee: `%2e%2e`
decodes to `..` and `%2f` to `/`, both refused, and a double-encoded `%252e` decodes to a literal `%`, also
refused. What is never done is decoding in a loop until the value stops changing. The
composed URL always ends in exactly one trailing slash (`trailingSlash: true`, `next.config.ts:18`). It carries
**nothing from the request's query**; the only query it may carry is the fixed chromeless hint the origin is
asked for (`od_embed=1`, decision D3), which is constant across every request and therefore cannot be
influenced by a visitor.

#### Scenario: Ordinary path
- **WHEN** `/legacy/materials/printed-products/` is requested and the origin is configured
- **THEN** the upstream URL fetched is `<origin>/materials/printed-products/?od_embed=1`

#### Scenario: Traversal is rejected
- **WHEN** a segment decodes to `..` or `.`
- **THEN** the response is 404
- **AND** no outbound fetch is made

#### Scenario: Percent-encoded traversal is rejected
- **WHEN** a segment still contains `%` after Next's own decoding (e.g. `%252e%252e` arriving as `%2e%2e`)
- **THEN** the response is 404
- **AND** no outbound fetch is made
- **AND** this holds regardless of how the URL parser would later normalise `%2e` segments

#### Scenario: Unlisted character, including a homoglyph
- **WHEN** a segment contains a character outside the allowlist — a full-width `％`, a zero-width joiner, a
  space, a quote, or any other codepoint nobody enumerated
- **THEN** the response is 404
- **AND** the rejection follows from the character not being allowed, not from a rule naming it

#### Scenario: Origin hijack is rejected
- **WHEN** a segment contains `@`, `:`, `\` or a scheme (e.g. `https://evil.example`)
- **THEN** the response is 404
- **AND** no outbound fetch is made

#### Scenario: Cyrillic slugs survive
- **WHEN** the path contains a non-ASCII slug (legacy WordPress serves Cyrillic slugs — 67 of 139 `/profile/`
  slugs are percent-encoded Cyrillic, `docs/wp-backend.md` §5), which the router delivers **percent-encoded**
- **THEN** the segment is decoded exactly once, and accepted
- **AND** the upstream URL carries it percent-encoded exactly once
- **AND** the iframe `src` the page emits is encoded exactly once too — encoding an already-encoded segment
  turns `%D0%B4` into `%25D0%25B4` and the proxy then refuses it
- **NOTE** this scenario originally asserted the opposite ("Next delivers already decoded") and was written
  with an ASCII fixture, so it passed while every Cyrillic URL 404'd in production. Found by `pnpm url:check`
  replaying real entry URLs, not by any test in the suite

#### Scenario: Request query string discarded
- **WHEN** `/legacy/team/?utm_source=x&s=foo` is requested
- **THEN** the upstream URL carries only the fixed chromeless hint, and nothing from the request
- **AND** two requests differing only in query produce the same upstream URL, and the same store key

#### Scenario: Empty path
- **WHEN** `/legacy/` is requested with no segments
- **THEN** the response is 404

#### Scenario: Fallback disabled
- **WHEN** the configured origin is `null` (LCP-001)
- **THEN** the response is 404
- **AND** no outbound fetch is made

### Requirement: Upstream fetch carries no credentials

The system SHALL fetch the legacy page with a bare `fetch` that sends no `Authorization` header, no cookies
and no forwarded request headers other than an explicit `Accept` and `User-Agent`, and SHALL NOT follow a
redirect that leaves the configured origin.

**ID**: LCP-003

**Invariants**: The WordPress application password (`WP_USER`/`WP_PASSWORD`, attached unconditionally by
`wpFetch` — `src/shared/api/httpClient.ts:45-58`) never reaches the legacy origin. Incoming cookies are
never proxied outbound — guaranteed by constructing the outbound headers explicitly rather than by copying
and filtering the inbound ones. The outbound `User-Agent` is fixed, so the upstream has nothing to vary on
and the cached document has exactly one variant.

#### Scenario: No credentials outbound
- **WHEN** any legacy page is proxied
- **THEN** the outbound request has no `Authorization` and no `Cookie` header

#### Scenario: Incoming cookies are not forwarded
- **WHEN** the browser request to `/legacy/team/` carries cookies
- **THEN** the outbound request carries none

#### Scenario: Same-origin redirect is followed
- **WHEN** the upstream answers 301 to another path on the same origin
- **THEN** the redirect is followed and the final document is returned

#### Scenario: Cross-origin redirect is refused
- **WHEN** the upstream answers 301 to a different origin
- **THEN** the response is 404
- **AND** the cross-origin body is not returned

#### Scenario: Redirect loop
- **WHEN** the upstream answers 3xx more than the allowed hop count
- **THEN** the response is 404

### Requirement: Upstream status mapping

The system SHALL map an upstream 404 or 410 to a 404, and SHALL map an upstream 5xx, a network error or a
timeout to a 404 with a server-side warning, never to a 5xx.

**ID**: LCP-004

**Invariants**: The route never returns a status outside {200, 404, 405} (405 only per LCP-009's
method scenario, which the framework answers). A non-HTML upstream content type is treated as a failure, not
proxied. Eligibility is decided by the same `isEmbeddable` the page uses, so the two surfaces cannot disagree
about which paths exist.

#### Scenario: Missing legacy page
- **WHEN** the upstream answers 404 (measured: `/definitely-not-a-page-xyz/` → 404)
- **THEN** the response is 404 with no body from upstream

#### Scenario: Origin down
- **WHEN** the fetch rejects, times out, or answers 502
- **THEN** the response is 404
- **AND** a warning naming the path and the cause is logged

#### Scenario: Non-HTML upstream response
- **WHEN** the upstream answers 200 with `content-type: application/pdf`
- **THEN** the response is 404
- **AND** the body is not proxied

#### Scenario: Repeated requests are consistent
- **WHEN** the same failing path is requested repeatedly
- **THEN** every response is 404
- **AND** no error state leaks between requests

### Requirement: Chrome removal

The system SHALL reduce the upstream document by **removing** `header#header`, `section#bottom` and
`footer#footer` and keeping everything else in the document, so that every `wp_head` and `wp_footer` asset —
including the scripts that follow `</footer>` — survives.

**ID**: LCP-005

**Invariants**: Removal, never keep-only: the transform deletes the three chrome elements and preserves the
rest of `<head>` and `<body>` verbatim apart from the rewrites in LCP-006/LCP-007/LCP-011 and the injections in
LCP-008. Tag-like text inside `<script>`, `<style>` and HTML comments is never treated as markup when matching
an element's extent. The transform never returns an empty `<body>`.

#### Scenario: Chrome removed, content kept
- **WHEN** the upstream document contains one `header#header`, one `section#middle`, one `section#bottom` and
  one `footer#footer` (measured on 7 page shapes)
- **THEN** the response contains the `section#middle` markup
- **AND** contains no `header#header`, `section#bottom` or `footer#footer`

#### Scenario: Footer scripts survive removal
- **WHEN** the upstream document places its `wp_footer` scripts after `</footer>` — measured: **40 of 52**
  script tags on `/team/` and **52 of 64** on `/materials/plakati/` sit after the footer element closes, and
  **zero** sit inside any chrome element
- **THEN** every one of those scripts is present in the response
- **AND** cmsms/welfare interactive widgets therefore still initialise

#### Scenario: Head assets survive removal
- **WHEN** any page is transformed
- **THEN** every `<link rel="stylesheet">` (30 measured) and inline `<style>` (12 measured) from `<head>` is
  still present

#### Scenario: A chrome element is absent
- **WHEN** the document has no `footer#footer` (a chromeless frozen-copy template)
- **THEN** the other removals still apply and no error is raised

#### Scenario: Content boundary missing
- **WHEN** the document contains no `section#middle`
- **THEN** the response is still the document minus the chrome elements
- **AND** a warning records the boundary miss for that path
- **AND** the body is not empty

#### Scenario: Unbalanced markup
- **WHEN** a chrome element's closing tag cannot be matched by depth counting
- **THEN** that element is left in place rather than truncating the document
- **AND** a warning records it

#### Scenario: Tag-like text inside a script, style or comment
- **WHEN** a chrome element contains `var msg = "</footer>";`, `<!-- <section> -->` or a `<style>` block with
  a selector containing `>` that reads as a tag
- **THEN** that text does not affect where the element is judged to end
- **AND** neither the chrome element nor any following content is truncated

#### Scenario: Every element-level strip is per-element
- **WHEN** the document contains many `<script>` elements and one of them matches a strip rule
- **THEN** only the matching element is removed
- **AND** no element between the document's first `<script>` and the matching one is affected — a single
  greedy span over `<script>…needle…</script>` dropped **11 of 52** scripts on `/team/` when measured

### Requirement: Asset resolution inside the proxied document

The system SHALL inject a single `<base>` element carrying the upstream document's own URL as `href` and
carrying **no `target`**, so that every relative reference in the document resolves against the legacy origin.

**ID**: LCP-006

**Invariants**: Nothing in the proxied document ever requests a path from the Next server: every asset
reference — root-relative, document-relative, inside `srcset`, or inside an inline `<style>` `url()` —
resolves against the legacy origin via the base URL. Exactly one `<base>` element exists in the output, and it
never sets a default browsing context: a `target` on `<base>` applies to *every* link and form in the
document, which would make an unrewritten link or an actionless form navigate the top-level window to the
legacy origin.

#### Scenario: Base element injected
- **WHEN** `/legacy/materials/printed-products/` is proxied
- **THEN** the response head contains exactly one
  `<base href="<origin>/materials/printed-products/">`
- **AND** that element carries no `target` attribute

#### Scenario: Root-relative asset resolves to the legacy origin
- **WHEN** the HTML contains `<img src="/wp-content/uploads/2021/02/Baltsevich.jpg">` (20 such on `/team/`)
- **THEN** the browser requests it from the legacy origin
- **AND** the Next server receives no request for `/wp-content/*`

#### Scenario: Document-relative asset resolves to the legacy origin
- **WHEN** the HTML contains a reference with no leading slash, e.g. `<img src="images/pattern.png">` or
  `url(fonts/x.woff)` in an inline style
- **THEN** it resolves under the legacy origin's copy of the current path, not under `/legacy/...`

#### Scenario: srcset and other asset attributes need no rewriting
- **WHEN** the HTML contains a `srcset`, `poster` or `data-src` with relative values
- **THEN** they resolve against the legacy origin
- **AND** the transform did not have to enumerate the attribute

#### Scenario: Third-party URLs are preserved
- **WHEN** the HTML references `https://fonts.googleapis.com`, `https://vk.com`, `https://i.ytimg.com`, the
  Punycode legacy domain, or a protocol-relative `//host/...`
- **THEN** those values are unchanged

#### Scenario: Idempotence
- **WHEN** the transform runs over its own output
- **THEN** the output is unchanged, and a second `<base>` is not added

### Requirement: Navigation out of the embedded document

The system SHALL keep every navigation initiated inside the embedded document on the new site: **every**
navigational `href` that resolves to a legacy site page — rooted, document-relative, query-only or already
absolute — is rewritten at transform time to the new site's absolute URL, and an injected delegated click
handler then places each click in the correct browsing context.

**ID**: LCP-011

**Invariants**: No click inside the frame may take the visitor to the legacy origin — in the top window, in the
frame, or in a new tab — and this holds with scripting disabled as well, because the rewrite covers every link
shape rather than leaving relative ones to the handler. Downloads and third-party links are the sole exception
and are deliberate: they *are* off-site destinations, and they open in a new context. No click may render the site shell inside the frame. In-page anchors stay inside the
frame. Downloads never destroy the page the visitor is on. "Current page" is judged against the document's
**base URL** (`document.baseURI`), never against `location.pathname`, which inside the frame carries the
`/legacy/` prefix and matches nothing.

#### Scenario: Every page link is rewritten, whatever its shape
- **WHEN** the HTML contains `<a href="/contacts/">`, `<a href="https://obshee-delo.ru/contacts/">`,
  `<a href="../about/">` or `<a href="?tab=1">`
- **THEN** each emitted attribute is the new site's absolute URL for the path that value resolves to against
  the page's own URL on the legacy origin
- **AND** with scripting disabled, clicking any of them still leaves the legacy origin out of the picture

#### Scenario: A fragment-only link is left alone
- **WHEN** the HTML contains `<a href="#comments">` or `<a href="#">`
- **THEN** the attribute is unchanged
- **AND** with scripting disabled, clicking it moves within the framed document rather than leaving it

#### Scenario: A same-page link with a fragment becomes fragment-only
- **WHEN** the HTML contains `<a href="/team/#section">` or `<a href="https://obshee-delo.ru/team/#section">`
  on the page `/team/`
- **THEN** the emitted attribute is just `#section`
- **AND** clicking it scrolls the frame rather than reloading the page — rewriting it to the site URL would
  turn an in-page scroll into a full navigation that loses the fragment, since the fragment addresses the
  framed document and not the parent

#### Scenario: Non-navigational schemes are left alone
- **WHEN** an `href` is `mailto:`, `tel:` or another non-HTTP scheme
- **THEN** the attribute is unchanged

#### Scenario: Only anchors are rewritten
- **WHEN** the document contains `<link rel="stylesheet" href="/css/custom.css">` or
  `<link rel="icon" href="/favicon.ico">` — an `href` on a non-anchor element, outside the asset paths
- **THEN** the attribute is unchanged and resolves against the base URL to the legacy origin
- **AND** the Next server receives no request for it — rewriting it onto the site origin would 404 and strip
  the page's styling, which is the failure the base URL exists to prevent

#### Scenario: Attribute quoting does not matter
- **WHEN** a `form action` or an anchor `href` is written unquoted, single-quoted, or with spaces around `=`
- **THEN** it is still recognised and handled
- **AND** an unrecognised `action` never survives into the response

#### Scenario: Click on a page link navigates the top-level window
- **WHEN** a visitor clicks a link that resolves to a site page — including a document-relative
  `<a href="../about/">`, a query-only `<a href="?p=2">`, or an already-rewritten absolute site URL
- **THEN** the top-level window navigates to that path on the new site
- **AND** neither the frame nor the top window ends up on the legacy origin
- **AND** the site shell is not rendered inside the frame

#### Scenario: In-page anchor scrolls the frame and navigates nothing
- **WHEN** a visitor clicks a link whose written `href` begins with `#` — including the bare `<a href="#">`
  scroll-to-top idiom, whose resolved `hash` is empty — or a link that resolves to the current document with
  a fragment
- **THEN** the default action is **prevented** and the frame is scrolled to that target by the handler
- **AND** the frame does **not** navigate to the legacy origin — letting the default proceed would, because
  the document's own URL is `/legacy/<path>/` and the resolved href is a *different document* on another
  origin, not a same-document fragment
- **AND** the top-level window does not navigate
- **AND** the comparison that identifies this case is against `document.baseURI`, so the `/legacy/` prefix on
  `location.pathname` cannot make it mismatch

#### Scenario: Anchor target missing
- **WHEN** the fragment names an element that is not in the document
- **THEN** the click still does not navigate anywhere
- **AND** the page stays where it is

#### Scenario: Download link does not destroy the page
- **WHEN** a visitor clicks `<a href="/wp-content/uploads/2019/11/Плакат.jpg">` — **33** such links on
  `/materials/plakati/`, the site's #6 entry page
- **THEN** the asset opens in a new browsing context
- **AND** the embedded page and the site shell both remain in place

#### Scenario: Download link that asks for the current context
- **WHEN** such a link carries `target="_self"`
- **THEN** it still opens in a new browsing context
- **AND** the frame is not navigated away to the asset — an author's `_self` must not be treated as consent
  to replace the embedded page

#### Scenario: Third-party link opens outside the frame
- **WHEN** a visitor clicks a link to `vk.com` or `youtube.com`
- **THEN** it opens in a new browsing context rather than inside the frame

#### Scenario: Modified click is left to the browser
- **WHEN** the click carries a modifier key, is a middle click, or has already been default-prevented
- **THEN** the handler does not interfere with the navigation
- **AND** it still ensures the link's destination is not the legacy origin

#### Scenario: Link with an explicit target
- **WHEN** the HTML contains `<a href="../about/" target="_blank">`
- **THEN** the destination opened in the new tab is the new site's `/about/`, not the legacy origin's
- **AND** this holds whether the transform's rewrite or the handler's correction gets there first — neither
  may hand a resolved legacy-origin page URL back to the browser

#### Scenario: Non-HTTP scheme
- **WHEN** a link uses `javascript:` or `data:`
- **THEN** the click is prevented
- **AND** `mailto:` and `tel:` links are left to the browser

#### Scenario: Form submission cannot leave the document
- **WHEN** a visitor submits any form in the embedded document
- **THEN** the submission is prevented
- **AND** neither the frame nor the top-level window navigates to the legacy origin

#### Scenario: Scripting unavailable
- **WHEN** the injected handler does not run
- **THEN** every page link still addresses the new site, because the rewrite — not the handler — carries them,
  and it covers document-relative and query-only forms too
- **AND** no link can navigate the top-level window at all, because `<base>` sets no target
- **AND** the residual cost is only that a page link opens inside the frame instead of replacing the shell,
  and that a download or third-party link opens in the frame rather than a new tab

### Requirement: Stripping analytics, canonical and cross-origin form actions

The system SHALL remove the legacy Yandex Metrica counter, remove the upstream `<link rel="canonical">`,
`<meta property="og:url">`, any upstream `<base>` element and any `<meta http-equiv="refresh">`, and remove
`action` attributes from forms.

**ID**: LCP-007

**Invariants**: A proxied page contributes no hit to the legacy site's analytics counter and advertises no
canonical of its own — the parent page owns the canonical (LPF-004). The upstream `<base>` is removed before
ours is injected (LCP-006), so exactly one survives. Removing `action` is only half the neutralisation:
with a `<base href>` in the document an actionless form submits to the **base URL**, i.e. the legacy origin,
so LCP-011's submit interception is what actually stops it. Analytics matching is anchored — a bare `ym(`
substring must not condemn an unrelated script (`everym(`, `displaym(`).

#### Scenario: Metrica removed
- **WHEN** the upstream HTML references `mc.yandex.ru` (2 references on `/team/`)
- **THEN** the response contains no `mc.yandex.ru` reference and no `ym(` initialiser

#### Scenario: Canonical and og:url removed
- **WHEN** the upstream HTML contains `<link rel="canonical" href="https://obshee-delo.ru/team/">`
- **THEN** the response contains no `rel="canonical"` and no `og:url`

#### Scenario: Meta refresh removed
- **WHEN** the upstream HTML contains `<meta http-equiv="refresh" content="0;url=…">`
- **THEN** it is not present in the response
- **AND** the framed document cannot navigate itself off the page without a click

#### Scenario: Upstream base removed before ours is injected
- **WHEN** the upstream HTML already contains a `<base>` element
- **THEN** the response contains exactly one `<base>`, the injected one

#### Scenario: Form action removed
- **WHEN** the upstream HTML contains `<form role="search" action="https://obshee-delo.ru">`
- **THEN** the emitted form has no `action` attribute
- **AND** its submission is additionally prevented per LCP-011

#### Scenario: A script that merely looks like the counter is kept
- **WHEN** a script contains an identifier ending in `ym(` such as `everym(` or `displaym(`, and no
  `mc.yandex.ru` reference
- **THEN** that script is retained

#### Scenario: Nothing to strip
- **WHEN** the upstream HTML has no counter, canonical, base or form
- **THEN** the HTML is returned unchanged by this step

### Requirement: Height reporter injection

The system SHALL inject a script into the proxied document that reports the document's full height to the
parent frame on load and whenever it changes, and that suppresses the document's own scrollbar **only once it
is running** — never via static CSS.

**ID**: LCP-008

**Invariants**: The injected script posts to `window.parent` only, with a message shape the parent
recognises, never throws, and is a no-op when the document is not framed. Scroll suppression and height
reporting are the same mechanism: if the reporter cannot run, the document must remain internally scrollable,
so no combination of failures can leave content unreachable.

#### Scenario: Height reported on load
- **WHEN** the embedded document finishes loading
- **THEN** it posts a message carrying its `scrollHeight` to the parent

#### Scenario: Height reported on change
- **WHEN** the embedded document's height changes after load (web fonts, a cmsms toggle, a slider)
- **THEN** a further message carries the new height

#### Scenario: Posting fails
- **WHEN** `postMessage` throws because the parent's origin does not match the target origin
- **THEN** the exception is swallowed and the embedded page keeps working

#### Scenario: Opened directly, not framed
- **WHEN** the proxied URL is opened as a top-level document
- **THEN** the script does not throw and the page renders

#### Scenario: No inner scrollbar while the reporter is alive
- **WHEN** the reporter is running and has reported a height
- **THEN** the document does not scroll internally, so the parent's height sync is the only scroll mechanism

#### Scenario: Reporter cannot run — content stays reachable
- **WHEN** the injected script never executes (blocked, or an earlier legacy script threw)
- **THEN** the document keeps its own scrollbar inside the frame
- **AND** every part of a 4000px page is reachable even though the frame stays at its starting height

#### Scenario: Late layout change
- **WHEN** the document's height changes after the initial report because of lazy images or a cmsms slider
- **THEN** a further height is reported within a bounded settling window after load
- **AND** no unbounded polling continues for the lifetime of the page

### Requirement: Proxy response construction

The system SHALL build the response from scratch — never by forwarding upstream response headers — and SHALL
return `content-type: text/html; charset=utf-8`, `X-Robots-Tag: noindex`, and
`Content-Security-Policy: frame-ancestors 'self'`, answering only GET.

**ID**: LCP-009

**Invariants**: No upstream response header is ever copied onto our response — in particular no `Set-Cookie`,
`content-encoding`, `content-length`, `cache-control`, `link` or `x-*` header. `/legacy/*` is never indexable
and can only be framed by our own origin.

#### Scenario: Successful proxy response
- **WHEN** a legacy page is proxied successfully
- **THEN** the status is 200, the content type is `text/html; charset=utf-8`, `X-Robots-Tag: noindex` and
  `Content-Security-Policy: frame-ancestors 'self'` are present

#### Scenario: Upstream Set-Cookie is not relayed
- **WHEN** the upstream response carries `Set-Cookie` (a WordPress session or test cookie)
- **THEN** our response carries no `Set-Cookie`
- **AND** no cookie is set on the site's domain

#### Scenario: Upstream hop and cache headers dropped
- **WHEN** the upstream response carries `content-encoding: gzip` (measured), a `content-length`, and
  `cache-control: max-age=0` (measured)
- **THEN** none of those headers appear on our response

#### Scenario: Method other than GET
- **WHEN** the route is requested with POST, PUT or DELETE
- **THEN** the response is 405
- **AND** no upstream fetch is made
- **NOTE** satisfied by exporting only `GET`: App Router answers 405 for every method a route does not export,
  so hand-written handlers added nothing but a chance to get `OPTIONS` wrong (Next answers that itself, and
  answering 405 to it is the wrong answer)

### Requirement: Caching and upstream load control

The system SHALL reuse a successful upstream document for up to an hour per path through a cache **it owns**,
SHALL never let a failure be reused, and SHALL bound both the time an upstream request may take and the number
that may run at once.

**ID**: LCP-010

**Invariants**: Reuse is a property of an explicit, bounded, success-only store keyed by path — not of Next's
fetch Data Cache, not of the route segment cache, and not of the upstream's own headers. **No failure — 404,
5xx, timeout or rejected path — is ever stored or reused** by that store. An unresponsive origin can never
exhaust the container's sockets or hold a request open indefinitely.

The fetch's own cache mode is **per surface**, and this is the one place the implementation had to diverge from
the design as written (amended after GATE 1 — see `reviews/impl-review.md`):

- The **proxy route** fetches `cache: 'no-store'`, as originally specified. It is the surface that serves the
  visitor the content, it is `force-dynamic`, and nothing outside the store may retain its response.
- The **catch-all page** fetches with `next: { revalidate: 3600 }` instead. It has no choice: the catch-all's
  `revalidate` is module-level and shared with the numeric branch that carries 46 % of site entries, so its
  render must stay statically generatable, and an uncached fetch discovered during that render aborts it with
  `DYNAMIC_SERVER_USAGE` — **HTTP 500** in a production build, where `next dev` answers 200. Measured, not
  reasoned: `pnpm build && pnpm start` 500s on every legacy path without this. `connection()` does not rescue
  it either; under a module-level `revalidate` it raises the same error.

The asymmetry is narrower than it looks. The page's only definitive outcome is `missing` (an upstream 404/410),
and `notFound()` under ISR is cached for the same window regardless; every other failure renders the embed
anyway. So the most a retained failure can cost on the page surface is a generic `<title>` until the window
rolls — which LPF-005's last scenario already accepts in writing. What the visitor reads comes from the proxy,
which still refuses to reuse a failure.

#### Scenario: Repeat request inside the window
- **WHEN** the same path is requested twice within the reuse window and the first succeeded
- **THEN** the second response is served without a second upstream render

#### Scenario: Upstream declares itself uncacheable
- **WHEN** the upstream sends `cache-control: no-cache` or `Set-Cookie`
- **THEN** our response is still reusable for the window, because the store is ours

#### Scenario: The page surface fetches cacheably
- **WHEN** the catch-all page or its `generateMetadata` loads a legacy document
- **THEN** the upstream fetch carries `next: { revalidate: … }` and **not** `cache: 'no-store'`
- **AND** a production build serves that path with a 200 rather than a 500

#### Scenario: The proxy surface fetches uncached
- **WHEN** `/legacy/*` loads a legacy document
- **THEN** the upstream fetch carries `cache: 'no-store'`
- **AND** a failure it returns is not reused by the next request

#### Scenario: Failure is never reused
- **WHEN** a request results in a 404 (missing page, origin down, rejected path, or concurrency shed)
- **THEN** nothing is written to the store
- **AND** the response carries `Cache-Control: no-store`
- **AND** the next request for that path performs a fresh upstream attempt
- **AND** a request made seconds after the origin recovers is served the real page

#### Scenario: Store is bounded
- **WHEN** more distinct legacy paths are served than the store's capacity
- **THEN** older entries are evicted rather than the store growing without limit
- **AND** an evicted path is simply re-fetched on its next request

#### Scenario: Entry expires
- **WHEN** a stored entry is older than the reuse window
- **THEN** the next request for that path fetches upstream again
- **AND** a stale entry is never served after a failed refresh unless doing so is an explicit, logged choice

#### Scenario: Slow origin
- **WHEN** the upstream does not respond within the configured timeout
- **THEN** the request is aborted and the response is 404
- **AND** the request does not hang past the timeout

#### Scenario: Burst of distinct paths waits rather than failing
- **WHEN** more distinct legacy paths are requested at once than the concurrency bound allows (a crawler
  sweep)
- **THEN** the number of simultaneous upstream requests stays at or below the bound
- **AND** the excess requests **wait for a slot** rather than answering 404 immediately
- **AND** every one of them is eventually served the real page if the origin answers in time

#### Scenario: Burst exceeds the wait budget
- **WHEN** a queued request cannot obtain a slot within its bounded wait
- **THEN** it answers 404 with `Cache-Control: no-store`
- **AND** that 404 is not reused for any later request
