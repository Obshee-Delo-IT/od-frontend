## Context

The catch-all `src/app/[...slug]/page.tsx` already owns every unclaimed path and `notFound()`s on non-numeric
ones (`:86-89`); the root layout already supplies header, `Container` and footer (`src/app/layout.tsx:59-67`);
`src/proxy.ts` already swallows `/video/*`, `/news/*`, `/category/*` and `/page/*` before the catch-all sees
them (`:35-37`). So the mechanism is one new route handler, one pure transform module, one client component,
and a branch swap — nothing structural.

The constraints that shape it, all from research: `trailingSlash: true` (`next.config.ts:18`); the catch-all's
`revalidate` is module-level and shared with the 46 %-of-entries post branch (`:25-26`); there is no
`wp-json` on the legacy origin (measured 404); `?embed=1` is WordPress core's oEmbed-card parameter, not a
chromeless switch (measured); the legacy DOM boundary is exactly one `#header` / `#middle` / `#bottom` /
`#footer` per page across seven probed shapes; and CI builds with no WP env at all, so nothing may throw at
module load (`src/shared/api/httpClient.ts:5-17`).

## Goals / Non-Goals

**Goals:**
- Serve every un-redesigned WordPress page at its live URL, inside the new shell, with its old look intact.
- Retire a page's fallback automatically the moment a native route for it exists.
- Add no runtime dependency, and no way for this to return a 5xx.
- Keep the legacy origin swappable by env alone (prod today → frozen copy later).

**Non-Goals:**
- Standing up the frozen copy, its chromeless template, or its REST switch (D1).
- SSR-injecting legacy content into the React tree (rejected: theme-CSS/JS coupled).
- Native routes for the Tier 2 pages, sitemap entries for embedded pages (ASM7), or a retired-page list (D12).
- Any change to the numeric-id branch's behaviour or cache policy.

## Decisions

**Shape.** Four pieces:

```
src/app/legacy/[...slug]/route.ts     GET handler: validate → fetch → transform → respond   (LCP-001..011)
src/shared/legacy/legacyOrigin.ts     env → origin | null, warn once                        (LCP-001)
src/shared/legacy/legacyPath.ts       segment allowlist, URL composition, origin pinning     (LCP-002)
src/shared/legacy/transformLegacyHtml.ts  pure (html, origin) → { html, title, description } (LCP-005..008)
src/modules/Legacy/LegacyEmbed/       client component: iframe + height listener             (LPF-006)
src/app/[...slug]/page.tsx            eligibility branch + metadata                          (LPF-001..005)
```

`src/shared/legacy/` rather than `src/shared/api/`: this is not a WordPress REST fetcher and must not be
re-exported from `src/shared/api/index.ts`, where every neighbour carries auth.

**D1/D3 → configuration.** `legacyOrigin.ts` reads `WP_LEGACY_BASE` at module load, `new URL()`-parses it,
keeps `url.origin` only, warns once and exports `null` on absence or garbage. The chromeless hint is
`?od_embed=1`, appended to every upstream request: inert on prod today, meaningful on a frozen copy that
implements it. **Never `?embed=1`** — measured, that returns WP's 21 KB oEmbed card in place of the 85 KB page.

**D2/D5 → the transform.** One pure function over the HTML string, in fixed order: **remove** the three chrome
elements by id (depth-counted tag matching, with `<script>`/`<style>`/comment regions masked so tag-like text
inside them cannot miscount the depth) → strip counter/canonical/`og:url`/upstream `<base>`/form `action`,
each **per element**, never as one span from the document's first matching open tag → rewrite **every**
navigational `href` that resolves to a legacy site page → inject our `<base href>` → append the injected runtime (height reporter, scroll
suppression, click and submit handlers) → return the HTML plus the `<title>`/description parsed on the way
through (so LPF-004 needs no second parse). Attribute matching is order-insensitive: an SEO plugin that emits
`<meta content="…" name="description">` must still be read.

**D14 (new, implementation-level): removal, not keep-only.** Options considered: (a) keep `section#middle` and
discard the rest of `<body>`; (b) remove `header#header`, `section#bottom`, `footer#footer` and keep
everything else. Chose (b) — (a) is a silent interactivity killer. Measured script placement: **40 of 52**
`<script>` tags on `/team/` and **52 of 64** on `/materials/plakati/` sit *after* `</footer>`, and **zero**
sit inside any chrome element. Keeping only `#middle` would drop every `wp_footer` script — jQuery init, the
cmsms widget bootstraps — which is the exact capability the iframe exists to preserve. Removal also makes ASM1
non-load-bearing: a page with no `#middle` still renders correctly, since the boundary is only used as a
sanity check, not as the cut.

**D15 (new, implementation-level): assets resolve via `<base href>`; navigation is handled separately.**
Options considered: (a) enumerate asset attributes and rewrite each root-relative or origin-absolute value in a
role-aware pass; (b) inject `<base href="<origin><path>/">` so the browser resolves every relative reference
against the legacy origin. Chose (b). The prototype was built as (a) and (a) is where the bodies were buried:
two chained global replaces cancel each other (absolutise → relativise turns a root-relative stylesheet back
into a 404 on our origin), and even as a single classifier it still misses **document-relative** references
(`src="images/x.png"`, `url(fonts/x.woff)`) — which resolve against `/legacy/<path>/` and hit the Next server —
plus `srcset`, and any attribute nobody enumerated. One `<base>` fixes the whole class at once, including
`url()` inside inline `<style>`, because CSS in the document resolves against the document base URL.

**The `<base>` carries no `target`.** The first version of this design used `target="_parent"` to stop an
in-content click from loading the site shell *inside* the frame, and review round 2 showed that cure to be
worse than the disease: a `target` on `<base>` is the default browsing context for *every* link and form in the
document, so the three things the transform does **not** rewrite — a document-relative `<a href="../about/">`,
a fragment `<a href="#comments">`, and a form left actionless by LCP-007 — would each navigate the visitor's
**top-level window to the legacy origin**, and a `/wp-content/…` download link would replace the whole site
with a raw JPEG. Base-relative resolution and default targeting have to be decided separately, and only the
first belongs on `<base>`.

Cost of (b), accepted: the document's base URL is the legacy origin, so legacy JS issuing a relative XHR now
attempts a cross-origin request that CORS will refuse, where before it would have 404'd on our origin. Both
are broken; neither is worse. `window.location` is unaffected, so the height reporter's origin handling is
unchanged.

**D17 (new, implementation-level): rewrite every page link at transform time; the delegated handler decides the
browsing context.** Options considered: (a) `target` on `<base>` (refuted above); (b) rewrite only *rooted*
`href`s and let an injected click handler catch the rest; (c) resolve and rewrite **every** navigational `href`
against the page's own legacy URL, and inject a delegated `click`/`submit` handler on top. Chose (c). (b) was
the round-3 design and round 6 refuted it: with scripting unavailable the handler never runs, so
`<a href="../about/">` resolves against the `<base>` and navigates the frame straight to the legacy origin —
the one thing LCP-011's invariant forbids. Resolving at transform time costs nothing extra (`new URL(value,
pageUrl)` — the same resolution the browser would do) and makes the no-JS floor complete. Fragment-only hrefs
(`#comments`, `#`) are deliberately *not* rewritten: left alone they move within the framed document, which is
correct with or without scripting. The handler then classifies the browser's already-resolved `a.href`:

| Resolved link | Handler does |
|---|---|
| Same document + fragment (compared against `document.baseURI`) | `preventDefault` and scroll the target into view **itself** — see below |
| Legacy origin, path under `/wp-content|/wp-includes|/wp-json` | opens in a new context — a download must not destroy the page |
| Legacy origin, any other path | rewrite `a.href` to the same path on the **new site**, then `preventDefault` and navigate `window.top` |
| New site origin (an already-rewritten link) | `preventDefault`, navigate `window.top` — otherwise the shell renders inside the frame |
| Third party | opens in a new context |
| `javascript:` / `data:` | `preventDefault` — `mailto:`/`tel:` are left alone |
| Modified click, middle click, explicit `target`, already default-prevented | leaves the navigation to the browser, **after** correcting `a.href` if it pointed at the legacy origin |

**The fragment row took three attempts and is the sharpest edge in this change.** A `<base href>` pointing at
another origin means an in-page anchor is *not* a same-document navigation any more: `<a href="#comments">`
resolves to `https://<legacy>/<path>#comments`, a different document on a different origin. Attempt one
compared `u.pathname` with `location.pathname` — which inside the frame is `/legacy/<path>/`, so it never
matched and every anchor became a top-level navigation. Attempt two compared against `document.baseURI`, which
identifies the case correctly, but then *returned* and let the browser do the default thing — which is to
navigate the **frame to the legacy origin**. The handler must therefore own the whole behaviour:
`preventDefault`, then `getElementById`/`getElementsByName` on the decoded fragment and `scrollIntoView`, and
do nothing at all if the target is missing. A link carrying its own `target` cannot simply be skipped either:
`<a href="../about/" target="_blank">` is document-relative, so the rewrite never touched it, and skipping it
opens the legacy origin in a new tab; nor may an author's `target="_self"` on a download be honoured, since
that replaces the embedded page with a JPEG. The rule that survives all of it: **decide same-document first,
correct the destination second, and only then decide the browsing context — never hand a resolved legacy-origin
URL back to the browser.**

Forms get a `submit` listener that calls `preventDefault` — with a `<base href>` in the document, removing
`action` (LCP-007) is *not* neutralisation, it just retargets the submission at the base URL. The rooted-`href`
rewrite is kept as the scripting-disabled floor: `/contacts/` → `https://<site>/contacts/`, with the
**asset-path carve-out** intact, because `/materials/plakati/` — the site's #6 entry page — carries **33**
`<a href="/wp-content/uploads/…">` download links that must stay on the legacy origin. `action` is *not* part
of that rewrite (it would defeat LCP-007); third-party and protocol-relative URLs are never touched.

**D6 → security.** `legacyPath.ts` accepts a segment only if every character is a Unicode letter, a Unicode
digit, `-`, `_`, `.` or `~`, and the segment is not empty, `.` or `..` — an **allowlist**, so `/`, `\`, `:`,
`@`, `?`, `#`, `%`, control characters and the homoglyphs nobody enumerated (a full-width `％`, a zero-width
joiner) are all rejected by omission rather than by a rule naming each one. Next hands params **already
decoded**, so a legitimate Cyrillic slug arrives as literal Cyrillic and a surviving `%` can only be a
re-encoding attempt — which is why no decode-again loop is needed to close `%252e%252e`. (The WHATWG URL parser does
normalise `%2e%2e` as a double-dot segment and cannot climb above the origin root, so this was defence in
depth rather than a live escape — but "cannot escape" is not a property worth resting on one parser's
conformance.) It composes with `new URL(encodeURI(path), origin)` and asserts `url.origin === origin` before
returning. The fetch is a bare `fetch` with `redirect: 'manual'`; a 3xx is followed only when its `Location`
resolves to the same origin, at most once. `wpFetch` is deliberately not used — it would attach the WordPress
application password to a third-party origin (`src/shared/api/httpClient.ts:45-58`).

The response is **constructed, never forwarded**: a fresh `Headers` carrying only our content type,
`X-Robots-Tag: noindex`, `Content-Security-Policy: frame-ancestors 'self'` and our cache directive. Copying
upstream headers would relay WordPress `Set-Cookie` onto the site's own domain — a session-fixation vector on
a domain that will later have sessions — and would republish an upstream `cache-control: max-age=0`
(measured) that defeats D13. A stricter CSP was considered and rejected: `sandbox` without
`allow-same-origin` would give real isolation, but an opaque origin makes `localStorage` throw and would
break legacy widgets that touch it; `frame-ancestors` is the part that costs nothing. ASM5 stands, with its
revisit trigger.

**D13 → caching, and why it is ours.** Three review rounds produced three mutually incompatible claims about
Next's caching semantics, none of them cited: that the fetch Data Cache is defeated by an upstream
`Set-Cookie`/`no-cache`; that a route-segment `revalidate` persists a **404** for the full hour; that the Data
Cache itself stores a failed response for the full hour; and that `force-dynamic` rewrites the outgoing
`Cache-Control`. They cannot all be true, and resolving which are would make correctness depend on framework
behaviour that changes between minor versions.

So the design stops depending on any of it. **The proxy owns its cache**: a bounded, in-process `Map` from
path to `{ html, title, description, expires }`, written **only on success**, capped in size with oldest-out
eviction. Every upstream fetch is made with `cache: 'no-store'`, so no Next layer can retain a failure; the
route is dynamic, so no route cache can either. The response still carries `Cache-Control`
(`public, s-maxage=3600, stale-while-revalidate=86400` on success, `no-store` on 404) as a hint to anything
downstream, but nothing in the requirements depends on that header surviving. Properties this buys, all
directly testable: an upstream `max-age=0` cannot defeat reuse; a one-second outage cannot freeze an hour of
404s; memory cannot grow without bound.

The cost is honest and already true of everything else here: the store is per-replica and dies on redeploy,
exactly like the ISR cache (`output: 'standalone'`). Upstream `content-encoding`/`content-length` are dropped —
`fetch` already decompressed and the body has been rewritten. The catch-all's `revalidate = 3600` is left
untouched, which is also why a page rendered during an outage keeps a generic `<title>` until it revalidates
(LPF-004/LPF-005): the content self-heals through the iframe, the title waits for the window. Accepted, not
papered over.

**D16 (new, implementation-level): bound time and concurrency, by queueing rather than shedding.** The upstream
fetch carries `AbortSignal.timeout(8000)` — Node's `fetch` has no default timeout, so an origin that accepts
and never answers would otherwise hold a request open indefinitely. Simultaneous upstream requests are capped
at 4, matching the concurrency this WP host already tolerates elsewhere in the repo
(`src/app/sitemap.ts:31-38`, `next.config.ts:69-72`). Over-cap requests **wait for a slot** with a bounded wait
(~4 s) instead of answering 404 immediately: review round 2 pointed out that shedding turns a ten-page crawler
burst into six 404s, which is a worse outcome than six slow pages — and worse still if any cache layer
persisted them. Only a request that cannot get a slot inside its wait budget answers 404, always `no-store`.
The simplicity lens argued for deleting the limiter entirely and relying on Node's defaults; rejected, because
"no limit" against a slow WordPress origin is exactly how ~170 crawlable slugs become ~170 concurrent sockets —
but the finding is why the limiter queues instead of failing.

**D7 → metadata.** `generateMetadata`'s non-numeric branch and the page component share one `cache()`d loader,
mirroring `resolvePostKind` (`src/app/[...slug]/page.tsx:39-49`) — but note what that does and does not buy:
it dedups **within one render pass**. The iframe's `/legacy/*` request is a separate HTTP request from the
browser, so `cache()` cannot span the two; each surface is bounded by its own cache instead (the page by the
catch-all's `revalidate`, the proxy by D13). A page view therefore costs at most two upstream renders per
hour per path, not one — stated plainly in LPF-004 rather than wished away. Title and description come from
the transform's parse; the canonical is always `canonicalUrl(path)`.

**D10 → height sync.** The injected script posts `{ type: 'od:legacy-height', height }` to `window.parent`
with `window.location.origin` as `targetOrigin` (wrapped in `try/catch`), on `DOMContentLoaded`, `load`, and a
`ResizeObserver` on `documentElement`, plus a **bounded** 1 s poll for the first ~10 s after load — the
settling window for lazy images and cmsms sliders, which do not always trigger an observable resize. The
unbounded interval the first draft used was cut on the simplicity lens's finding; a permanent 1 Hz timer on
~170 transitional pages buys nothing after layout settles.

**The scrollbar suppression moved into the script.** It was static CSS (`overflow-y: hidden !important`), and
review round 2 showed that combination is a content trap: if the reporter never runs, the frame stays at its
starting height *and* the document cannot scroll, so a 4000px page shows its first 500px and nothing else is
reachable. The script now sets `overflow: hidden` itself, as its first act — so the failure mode is a frame
with an inner scrollbar (ugly, complete) instead of an unreachable page.

`LegacyEmbed` accepts a message only when `event.origin === window.location.origin`, `event.source` is the
iframe's own `contentWindow`, the type matches, and the height is a finite number in `(0, 50000]`. Starting
height is `60vh` so a failed sync still shows content.

**D4 → placement.** The page body renders `<LegacyEmbed>` only. It stays inside the layout's `Container`; the
resulting narrower-than-original rendering is the accepted cosmetic compromise, revisited only if the sample
pages look broken rather than narrow.

**D12 → eligibility.** A pure `isEmbeddable(slug)` in `src/shared/legacy/`: reject reserved first segments
(`legacy`, `_next`, `api`), a last segment containing a dot, depth > 6, and any slug in an exported empty
`LEGACY_DENYLIST`. Tested like `legacyRedirects.test.ts`.

## Invariants

1. No path that returns 404 today may return 5xx after this change.
2. No outbound request from `/legacy/*` reaches any origin other than the configured one.
3. No outbound request from `/legacy/*` carries `Authorization` or `Cookie`.
4. The catch-all's numeric branch — its probe, its render, its `revalidate`, its `generateStaticParams` — is
   byte-for-byte unchanged in behaviour.
5. `/category/*`, `/news/page/N`, `/page/N`, `/video/short/` still take exactly one 301 and never embed.
6. Exactly one site header and one site footer per rendered document.
7. A proxied document requests nothing from our origin's paths — no `/wp-content/*`, and no
   document-relative asset resolving under `/legacy/*`, ever reaches the Next server.
8. Every `<script>`, `<link rel="stylesheet">` and `<style>` present upstream outside the three chrome
   elements is present in the response — in particular the `wp_footer` scripts that follow `</footer>`.
9. Clicking any in-content navigation link navigates the top-level window; the site shell never renders
   inside the frame.
10. The canonical for an embedded page is on `SITE_URL`; no canonical anywhere points at the legacy origin.
11. `/legacy/*` responses are always `noindex`, always framed only by our own origin, and never carry an
    upstream header — no `Set-Cookie` reaches the browser.
12. A failure is never written to the proxy's store and never reused; the store is bounded in size.
13. No click inside the frame reaches the legacy origin — not in the top window, not in the frame, not in a
    new tab.
14. The transform is idempotent: running it over its own output changes nothing, and adds no second `<base>`.
15. The transform never returns an empty `<body>`.
16. No upstream request outlives the timeout, and no more than the configured number run at once.
17. Importing any new module with no env set neither throws nor performs I/O.

## Failure Modes

| Failure | Detection | Degradation | Recovery |
|---|---|---|---|
| `WP_LEGACY_BASE` unset (CI, misconfigured deploy) | One warn at module load; `/legacy/*` 404s | Catch-all `notFound()`s — exactly today's behaviour | Set the env var and redeploy |
| Legacy origin down / times out | `console.warn` per path with cause | `/legacy/*` answers 404 (`no-store`); the **page** still renders the embed (LPF-005), so a recovered origin fills the frame on the next load without waiting for revalidation | Origin recovers; the next `/legacy/*` request is live |
| Legacy page genuinely absent (upstream 404) | Upstream status | Our 404 | Correct behaviour, no action |
| `#middle` absent on some page (ASM1 wrong) | `console.warn` "boundary miss" naming the path | None — removal-based extraction (D14) does not depend on the boundary | Nothing required; the warning is informational |
| Chrome markup unbalanced, depth match fails | `console.warn`; the chrome element survives | Page shows a duplicated legacy header rather than a truncated document | Fix the matcher for that shape |
| Upstream sets a cookie or `no-cache` | Would silently defeat caching or set a cookie on our domain | Neither is possible: the response is constructed from scratch and cached one layer up (D13) | N/A — by construction |
| Transient origin outage caches an hour of 404s | `[legacy] upstream …` warnings with no matching recovery | Failure responses are `no-store` and the page branch renders the embed instead of `notFound()` on 5xx (LPF-005) | Origin recovers; next request is live |
| Bot sweeps ~170 slugs at once | Upstream latency spike, concurrency counter at its cap | Sockets bounded at 4; over-cap requests **queue** for a slot and are served, and only a request that exhausts its ~4 s wait budget answers 404 (`no-store`, never stored) (D16) | Raise the reuse window if it recurs |
| Legacy JS issues a relative XHR | Browser console CORS error | That call fails; page otherwise fine (accepted cost of D15) | Only fixable on the legacy origin |
| Theme JS throws because chrome markup is gone (ASM2 wrong) | Visual check on the 5-page sample; browser console | Page renders, one widget inert | Hide chrome with CSS instead of removing it |
| Height sync never fires (script blocked, load error) | Iframe stays at 60vh | Content visible, clipped | Interval backstop usually recovers it; else fixed-height fallback |
| Height message from a foreign frame | Origin check rejects it | Height unchanged | N/A — by construction |
| Slug crafted to move the fetch off-origin | Origin assertion fails | 404, no fetch | N/A — by construction |
| Upstream serves non-HTML (PDF at a page URL) | Content-type check | 404, body not proxied | Link to the asset directly instead |
| **Partial failure:** transform succeeds but a rewrite misses a reference | Broken image/font in the browser; DevTools 404 on our origin for `/wp-content/*` | Page renders unstyled in part | Extend the classifier + add a fixture test |
| **Retry / idempotency:** the same path fetched repeatedly | Every request is a pure GET of a cached document | Identical output; the transform is idempotent (invariant 14) | N/A |
| **Concurrency:** many first-hits on distinct legacy paths at once | Upstream latency climbs | Next's per-path dedup plus the ISR window bound it; the fallback is ~15 % of entries spread over ~170 URLs | If the origin buckles, lower it further with a longer revalidate |

## Blast Radius

If the transform is wrong, ~170 low-traffic pages look broken — noticed first by whoever runs `pnpm url:check`
or clicks a header nav link. If eligibility is wrong, a path that should 404 embeds something odd, or a
Tier 2 native route gets shadowed — caught by the precedence scenarios in LPF-002 and by `url:check`. If the
SSRF guard is wrong, the container becomes an open-ish proxy for one attacker-chosen origin — nobody notices
from the UI, which is why LCP-002/003 carry unit tests rather than a visual check. The numeric branch, the
home page, `/news/`, `/video/*` and the redirect layer are untouched: a total failure of this change leaves
85 % of entry traffic unaffected.

## Data and Migration

N/A — no schema, no persistence, no backfill. The only stateful surface is the per-replica ISR cache, which is
discarded on redeploy (`output: 'standalone'`). Forward/backward compatible during deploy: old replicas 404
these paths, new ones embed them; no shared state, so a mixed fleet is consistent per-request. Rollback is
unsetting one env var (proposal §Rollback).

## Observability

Today there is no logging channel beyond stdout, which Coolify captures — so the signals are `console.warn`
lines, deliberately shaped to be greppable and each one distinct:

- `[legacy] WP_LEGACY_BASE missing — legacy fallback disabled` (once, at boot) — the single line that explains
  a fleet-wide "everything 404s".
- `[legacy] upstream <status> for <path>` — 5xx/timeout rate.
- `[legacy] boundary miss for <path>` — the ASM1 falsifier, per page.
- `[legacy] rejected path <path>` — SSRF/traversal attempts.

`pnpm url:check` is the periodic external signal: coverage should sit near 100 % and any regression shows up
traffic-weighted (`scripts/check-legacy-urls.mjs`, baseline 83.7 %). No new dashboard is proposed; a task
covers adding the four log lines, since they are the only production signal this change gets.

## UX Check

Product-facing. Prototype built before any implementation code, from real captured pages:
`/.scratch/a6-prototype/` — open `shell.html` in a browser and use its two nav links to switch pages
(`node build.mjs <capture>.html <legacy-origin> <path> <site-origin>` regenerates; `/.scratch/` is gitignored).

The prototype earned its keep three times over. It is what exposed the two-pass URL rewrite cancelling itself
(now D15), the 33 `<a href="/wp-content/…">` downloads on `/materials/plakati/` that a naive href rule would
404, and — after the review panel flagged the `wp_footer` risk — that a single greedy
`<script>…mc.yandex.ru…</script>` regex silently swallowed **11 of 52** script tags on `/team/`, because it
starts matching at the first `<script` on the page. The transform must therefore iterate script elements and
drop the ones that match, never span from the first opening tag; the same applies to every element-level
strip in LCP-007.

Round 2 then refuted the prototype's own `<base target="_parent">` (see D15/D17) and the static
`overflow-y: hidden`, both of which the prototype now implements the corrected way — the injected runtime does
the scroll suppression and the click/submit routing.

Measured on the current prototype output across `/team/`, `/materials/plakati/` and `/faq/`: all three chrome
elements removed, **0 external scripts lost** (52/64/60 upstream scripts all still present, minus Metrica, plus
the injected runtime), exactly **1** `<base>` and **0** carrying a `target`, 0 Metrica references, 0 canonical
tags, 0 surviving form actions, no static overflow CSS, rooted in-content navigation rewritten to the new site
(6/7/4 links) and `/wp-content/` download links left intact (0/32/3).

Drunk-user path: a visitor lands on `/team/` from Yandex. They see the site's real header and footer, and
between them the page they expected, looking like the old site. There is no spinner state to misread — the
iframe's document is server-rendered HTML, so it paints in one pass; the only visible transition is the frame
growing to its full height, which happens before scroll matters. Nothing is clickable-but-dead: clicking an
in-content link navigates the **whole window** to that path on the new site — so they land on a redesigned
route or another fallback page, with the address bar showing the URL they went to. Clicking a poster or a PDF
opens it in a new tab and leaves the page they were reading where it was. An in-page anchor just scrolls.
Nothing they can click strands them on a second copy of the site inside a box, and nothing sends them to a
different domain. There is no ambiguous label, no hidden toggle and no silent wait. The one honest wart is
width: the embedded page sits inside `Container`, so a full-bleed legacy layout is narrower than on the old
site (D4) — legible, not broken. If the origin is down the visitor gets a 404, which is the same answer they
get today, not a spinner that never resolves; and if the injected script is blocked they get a page with an
inner scrollbar rather than a page they cannot scroll.

## Complexity Budget

The whole thing is ~300 lines of source: one route handler, three small pure modules, a ~50-line injected
runtime (height reporter + click/submit routing), one ~40-line client component, one branch. Deliberately
**not** built: a DOM library (D5), a `cacheHandler` or CDN rule, an on-demand revalidation hook, a legacy
search implementation, per-page metadata overrides, a custom `not-found.tsx` (a real gap, but pre-existing and
not this change's job), sitemap entries (ASM7), a chromeless WP template (D1), and any allowlist of legacy
slugs — eligibility is a denylist because the set of pages is open and changes without us.

The simplicity lens argued for four more cuts. Two were taken: the permanent 1 Hz height poll became a bounded
settling window, and `action` came out of the href rewrite. Two were declined, with reasons on the record: the
concurrency limiter stays (queueing, not shedding — see D16), because "rely on Node's defaults" against a slow
WordPress origin is how ~170 crawlable slugs become ~170 concurrent sockets; and the upstream fetch in
`generateMetadata` stays, because the alternative leaves ~170 pages sharing one generic title, which is a
visible SEO regression on the very traffic this change exists to keep. The empty `LEGACY_DENYLIST` also stays:
three lines now against an unknown edit later, on a mechanism whose whole purpose is to retire pages.

## Risks / Trade-offs

- Regex HTML rewriting is a classic footgun — and it bit twice in the prototype (self-cancelling passes, a
  greedy script strip eating 11 tags) → mitigations: removal anchored on measured `id=` boundaries with
  depth-counted tag matching, element-level iteration for every strip (never a span from the first opening
  tag), `<base>` doing the asset work instead of an attribute enumeration, fixture tests over three real
  captured pages asserting no script is lost, and a required idempotence property (invariant 14).
- Legacy scripts execute same-origin (ASM5) → acceptable while the site has no auth or cookies; recorded with an
  explicit revisit trigger, and the counter that would have exfiltrated pageviews is stripped anyway.
- Iframe SEO is weaker than SSR → already priced at ~15 % of entries on pages being replaced, with the four
  highest-value ones going native instead.
- ASM1 (one `#middle` everywhere) is verified on 7 of ~174 pages → after D14 the boundary is no longer the cut,
  so ASM1 is informational: a page without it still renders. A scripted sweep over all 174 remains a
  verification task, now as a warning-count check rather than a correctness gate.
- The legacy origin becomes an availability dependency for these paths → bounded to ~15 % of entries, cached
  for an hour, and failing closed to 404.

**Disposition of the research unknowns**, so none of them is silently dropped: U1 (frozen copy) is decided as
D1 and re-scoped out of this change; U2 (retired pages) is D12's empty denylist; U3 (sitemap) is ASM7; U4
(chrome removal breaking theme JS) is ASM2, falsified by the fixture test and the 5-page visual check; U5
(Metrica) is ASM6/D9; U6 (container egress to the legacy origin) is an A2 deploy-time check, named in the
verification plan's production signal.

## Open Questions

<!-- Empty at gate time. Every unknown from research.md is dispositioned in the paragraph above: each is
     either a recorded decision, a recorded assumption, or a named verification step. -->

