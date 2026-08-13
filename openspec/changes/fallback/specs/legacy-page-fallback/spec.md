## ADDED Requirements

### Requirement: Fallback eligibility

The system SHALL serve the legacy embed from the catch-all route for a non-numeric path only when that path
is not reserved, not denylisted, does not end in a segment containing a dot, and is within a bounded segment
depth — and SHALL `notFound()` otherwise.

**ID**: LPF-001

**Invariants**: The numeric-id branch (46 % of site entries, `src/app/[...slug]/page.tsx:28,83-96`) is
evaluated first and is never affected by this requirement. Eligibility is a pure function of the path and the
denylist, with no I/O.

#### Scenario: Ordinary un-redesigned page
- **WHEN** `/team/` is requested and no native route matches
- **THEN** the catch-all renders the legacy embed for `/team/`

#### Scenario: Numeric path still goes to the post branch
- **WHEN** `/73381/` is requested
- **THEN** the post-kind probe runs and a news or film page renders
- **AND** no embed is rendered

#### Scenario: Reserved prefix
- **WHEN** the first segment is `legacy`, `_next` or `api`
- **THEN** the response is 404
- **AND** no proxy request is made

#### Scenario: Dotted last segment
- **WHEN** the path is `/favicon.png/` or `/apple-touch-icon.png/`
- **THEN** the response is 404

#### Scenario: Denylisted slug
- **WHEN** a path's slug is present in the denylist
- **THEN** the response is 404
- **AND** the page is not embedded

#### Scenario: Empty denylist at launch
- **WHEN** the denylist is empty (its shipped state, decision D12)
- **THEN** no path is rejected on denylist grounds

#### Scenario: Absurd depth
- **WHEN** the path has more segments than the bound
- **THEN** the response is 404

### Requirement: Real routes and redirects take precedence

The system SHALL never embed a path that a native route serves or that the redirect layer rewrites, and
adding a native route SHALL retire that path's fallback with no other change.

**ID**: LPF-002

**Invariants**: App Router precedence (static and dynamic segments beat `[...slug]`) is the only mechanism
relied on for native routes; `src/proxy.ts` runs before the catch-all for the four legacy prefixes.

#### Scenario: Existing native routes win
- **WHEN** `/`, `/news/`, `/video/`, `/video/filmy/`, `/materials/articles/` or `/health/` is requested
- **THEN** the native route renders and no embed appears

#### Scenario: A newly added native route retires its fallback
- **WHEN** a route file for a previously embedded path is added
- **THEN** that path renders natively
- **AND** no denylist entry or other edit is required

#### Scenario: The redirect layer still owns its prefixes
- **WHEN** `/category/oblast/piter/`, `/news/page/3/`, `/page/5/` or `/video/short/` is requested
- **THEN** a single 301 is issued by `src/proxy.ts`
- **AND** no embed is rendered

#### Scenario: An unknown film segment still 404s
- **WHEN** `/video/not-a-category/` is requested
- **THEN** `app/video/[segment]/page.tsx` `notFound()`s
- **AND** the path does not fall through to the embed

### Requirement: Embedded page rendering

The system SHALL render an eligible legacy path as an iframe pointing at `/legacy/<path>/` inside the site's
existing shell, with an accessible name, and SHALL NOT render its own header or footer.

**ID**: LPF-003

**Invariants**: The root layout (`src/app/layout.tsx:59-67`) is the only source of header and footer. The
iframe is same-origin, so no `X-Frame-Options`/CORS handling is needed. The site shell is never rendered
inside the frame.

#### Scenario: Embed rendered
- **WHEN** `/team/` is served by the fallback
- **THEN** the page contains exactly one iframe whose `src` is `/legacy/team/`

#### Scenario: Iframe has an accessible name
- **WHEN** any embedded page renders
- **THEN** the iframe carries a non-empty `title` attribute in Russian
- **AND** a screen reader announces the frame rather than an unnamed region

#### Scenario: Shell not duplicated
- **WHEN** any embedded page renders
- **THEN** the document contains exactly one site header and one site footer, both from the layout

#### Scenario: In-content navigation does not nest the shell
- **WHEN** a visitor clicks a navigation link inside the embedded document
- **THEN** the top-level window navigates to that path
- **AND** no header, footer or second iframe appears inside the frame

#### Scenario: Path is preserved through the embed src
- **WHEN** the path is multi-segment and slashed, e.g. `/materials/printed-products/`
- **THEN** the iframe `src` is `/legacy/materials/printed-products/` with a single trailing slash

#### Scenario: Non-ASCII path
- **WHEN** the path contains a Cyrillic slug
- **THEN** the iframe `src` carries it encoded exactly once and resolves

### Requirement: Embedded page metadata

The system SHALL derive an embedded page's title and description from the proxied document's `<title>` and
`<meta name="description">`, emit a canonical pointing at the site's own URL for that path, and fall back to
the site defaults when the upstream provides neither.

**ID**: LPF-004

**Invariants**: The canonical is always `canonicalUrl(path)` on `SITE_URL` — never the legacy origin
(`src/shared/config/site.ts:29-41`). A page view costs at most **one** upstream render per path per
revalidate window **per surface**: the parent page's metadata fetch and the iframe's `/legacy/*` request are
two separate HTTP requests, so `cache()` cannot join them — each is bounded by its own cache
(LCP-010 for the proxy, the catch-all's `revalidate = 3600` for the page).

#### Scenario: Title taken from upstream
- **WHEN** the upstream document's title is `Команда организации — Общее дело` (measured)
- **THEN** the page's `<title>` reflects it
- **AND** HTML entities in it are decoded

#### Scenario: Canonical is ours
- **WHEN** `/team/` is embedded
- **THEN** the canonical is `<SITE_URL>/team/`
- **AND** no canonical references the legacy origin

#### Scenario: Description absent upstream
- **WHEN** the upstream document has no `<meta name="description">` (measured on `/team/`)
- **THEN** metadata omits the description rather than emitting an empty one

#### Scenario: Attribute order does not matter
- **WHEN** the upstream emits `<meta content="…" name="description">` — the order some SEO plugins produce
- **THEN** the description is still extracted

#### Scenario: Upstream unavailable during metadata generation
- **WHEN** the upstream fetch fails while generating metadata
- **THEN** metadata generation does not throw
- **AND** the site's default title is used

#### Scenario: Metadata does not add a third fetch
- **WHEN** `generateMetadata` and the page component both run for the same request
- **THEN** the upstream is fetched at most once during that render pass
- **AND** the iframe's later `/legacy/*` request is the only other upstream fetch for that page view

### Requirement: Degradation when the fallback cannot serve

The system SHALL respond 404 — not 500 — whenever the legacy origin is unconfigured or the page does not
exist upstream, SHALL distinguish a definitive upstream 404 from a transient upstream failure so a blip is
not cached as a 404 for the whole revalidate window, and SHALL leave the site's other routes unaffected.

**ID**: LPF-005

**Invariants**: No path that 404s today may start returning 500. Unsetting `WP_LEGACY_BASE` restores exactly
today's behaviour on every path this change touches. A `notFound()` under ISR is cached, so it is reserved
for answers the upstream stated definitively.

#### Scenario: Origin unconfigured
- **WHEN** `WP_LEGACY_BASE` is unset and `/team/` is requested
- **THEN** the response is 404
- **AND** the home page, `/news/`, `/video/` and `/<id>/` are unaffected

#### Scenario: Page absent upstream
- **WHEN** the upstream answers 404 or 410 for the path
- **THEN** the page 404s

#### Scenario: Transient upstream failure still renders the embed
- **WHEN** the upstream 5xxs or times out while the page is rendering
- **THEN** the page renders the embed with default metadata rather than `notFound()`
- **AND** a warning is logged
- **AND** no 404 is cached for the revalidate window
- **AND** the iframe re-requests `/legacy/*` independently, so the content appears once the origin recovers

#### Scenario: Metadata generated during an outage stays generic until revalidation
- **WHEN** a page is rendered while the upstream is failing and that render enters the ISR cache
- **THEN** the visible content is correct as soon as the origin recovers, because the iframe fetches
  independently
- **AND** the parent page's `<title>` remains the site default until the ISR window elapses — an accepted,
  documented consequence of the shared `revalidate = 3600`, not a defect to be worked around with on-demand
  revalidation in this change

#### Scenario: Build without secrets
- **WHEN** `pnpm build` runs with no WP environment at all (CI)
- **THEN** the build succeeds
- **AND** no legacy fetch is attempted during it

### Requirement: Iframe height follows the embedded document

The system SHALL size the iframe to the embedded document's reported height, accepting height messages only
from the site's own origin, so that the embedded page shows no inner scrollbar.

**ID**: LPF-006

**Invariants**: Only messages whose `event.origin` equals `window.location.origin`, whose `event.source` is
the iframe's own `contentWindow`, and whose payload matches the agreed shape may change the iframe height.
The iframe has a non-zero starting height so a failed sync never yields an invisible page.

#### Scenario: Height applied
- **WHEN** the embedded document posts a height of 4200
- **THEN** the iframe's height becomes 4200px

#### Scenario: Height updated after layout change
- **WHEN** a further message reports a larger height
- **THEN** the iframe grows to match

#### Scenario: Foreign-origin message ignored
- **WHEN** a message with the height shape arrives from another origin
- **THEN** the iframe height is unchanged

#### Scenario: Same-origin message from another frame ignored
- **WHEN** a same-origin message with the height shape arrives from a window that is not this iframe
- **THEN** the iframe height is unchanged

#### Scenario: Malformed payload ignored
- **WHEN** a same-origin message carries a non-numeric, negative or absurdly large height
- **THEN** the iframe height is unchanged

#### Scenario: No message ever arrives
- **WHEN** the embedded document never reports a height (script blocked, load failure)
- **THEN** the iframe retains its starting height and remains visible

#### Scenario: Listener cleaned up
- **WHEN** the embedded page is navigated away from
- **THEN** the message listener is removed
