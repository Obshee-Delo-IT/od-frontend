# Implementation notes

**The record.** What shipped, what was measured, and why — including reasoning that has since been superseded. [`implementation-plan.md`](./implementation-plan.md) is the forward-looking half and stays short; everything that *closed* moved here so the plan doesn't have to carry it.

Read this when you're asking **"why is it like this?"** or **"has X been done?"**. Read the plan when you're asking **"what next?"**.

Nothing is deleted here — superseded reasoning is marked *historical* rather than removed, because the next person to have the same idea deserves to find out why it was dropped.

**Contents**
1. [Shipped — foundations (A)](#1-shipped--foundations-a)
2. [Shipped — design system (C)](#2-shipped--design-system-c)
3. [Shipped — pages (D)](#3-shipped--pages-d)
4. [Shipped — data & media (B, E)](#4-shipped--data--media-b-e)
5. [Shipped — quality (F)](#5-shipped--quality-f)
6. [Research — the live site (2026-05-29)](#6-research--the-live-site-2026-05-29)
7. [Research — traffic (Yandex Metrica, 91 days)](#7-research--traffic-yandex-metrica-91-days)
8. [Answered questions and superseded decisions](#8-answered-questions-and-superseded-decisions)

---

## 1. Shipped — foundations (A)

### A2. Hosting / deploy — DECIDED 2026-07-13

**Beget VPS running Coolify; images built in GitHub Actions → GHCR; the VPS only pulls and runs.** Full rationale, sizing and cost in the ops repo: [`servers-agent/docs/vps-coolify-plan.md`](../../servers-agent/docs/vps-coolify-plan.md) («План А», §2 architecture + the dedicated **od-frontend** section) and [`vps-coolify.md`](../../servers-agent/docs/vps-coolify.md) for server access. Consequences for this repo:

- **The VPS never builds.** Next 16 + React Compiler needs ~1.5–3 GB during build and would OOM alongside Coolify/Outline. CI builds with a stub client and no WP secrets, so no content is prerendered into the image; every page fills via ISR at runtime.
- **`images.remotePatterns` is computed at build time** from `WP_BASE` + `WP_MEDIA_CDN` (`next.config.ts`), so both must be passed as **build-args** or `next/image` 400s on production hosts. Neither is secret; `WP_USER`/`WP_PASSWORD` are *not* needed at build.
- **Runtime env in Coolify:** `WP_BASE`, `WP_USER` (secret), `WP_PASSWORD` (secret), `WP_MEDIA_CDN`, `SITE_URL`, later `WP_LEGACY_BASE`. No `NEXT_PUBLIC_*` — WP credentials never reach the browser.
- **Container:** port 3000, `HOSTNAME=0.0.0.0`, non-root `nextjs` user (already in the Dockerfile). **512 MB – 1 GB RAM** — idle 80–150 MB, but `sharp` peaks 300–500 MB during image optimisation, so 256 MB risks OOM. Set a hard `mem_limit` and `--max-old-space-size` 256–384; V8's lazy GC will otherwise grow to fill the host.
- **Persistent volume on `/app/.next/cache`** — ISR pages and optimised images aren't in the image, so without it every redeploy cold-starts into a burst of requests against the slow WP plus full image re-encoding. Cache stays per-replica.
- **Pin the Next minor** — the repo is on **16.0.1** (exact, no caret). **16.1.0** has a known Docker memory-leak thread (vercel/next.js#88603); if you move, watch for a sawtooth in container memory.
- **WordPress does not move to the VPS** (PHP + MySQL vs a Postgres-only box). The front container reaches WP over public HTTPS; no network adjacency needed.
- **Capacity:** stage + prod are two Node processes (no DB) — ~0.35 GB at rest, ~0.7 GB at simultaneous peak, comfortable on the planned 2/4/40. Foreign hosting was acceptable but is moot: the site serves only public content, and 152-FZ applies to where form submissions land (B6).

**`/health` endpoint — 2026-08-04** (`src/app/health/route.ts`): plain `ok`, no WP fetch, so a WP hiccup can't make Coolify restart a healthy container. Probing `/` would render the whole homepage on every check. **Since A8's `trailingSlash: true`, the probe target is `/health/`.**

**`.dockerignore` — fixed 2026-08-04.** The file was named **`.docerkignore`** (typo), so Docker never read it while the Dockerfile does `COPY . .` — any build from a working copy would have baked `.env` (WP application password, Kinescope token) into an image layer. Renamed and extended to cover `.env*`, `.scratch`, docs, tests and scripts.

### A3. CI pipeline — DONE

Deploy is wired via the Coolify GitHub app (triggers on push). `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` on `pull_request` (any base) **and** on `push` to `main`. Concurrency cancels in-flight PR runs (latest commit wins) but lets every main-branch commit complete, so each deploy has its own pass/fail. pnpm pinned to 11.3.0 matching the Dockerfile; Node read from `.nvmrc`; JavaScript actions opted into the Node 24 runtime via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` ahead of the 2026-06-16 default flip.

The build runs **without** WP secrets — `httpClient` and `next.config.ts` detect missing/empty `WP_BASE`/`WP_USER`/`WP_PASSWORD` and substitute a stub fetch returning `[]`, so compilation + RSC boundaries are still validated end-to-end. Real-data builds are Coolify's job, where the secrets live. The `lint · type-check · test · build` check is a required status check on `main` via a Rulesets entry, so Coolify never auto-deploys a red commit.

### A8. URL compatibility with the live site — DONE 2026-08-13

Commits `1bd016d`, `f0ac6a9`, `cbfc8d5`, `908b292`, `ea290ac`, `8173f1e`. Surfaced by the traffic read (§7): the live URL shapes below carried **59 % of all site entries** and the redesign served none of them.

| live URL | 91-day entries | before A8 | now |
|---|---:|---|---|
| `/<id>/` — *every* post (news, article, film, event video), 3 517 URLs | **12 530 (46.5 %)** | 404 — we served `/news/<id>` or `/video/<id>` | **served directly, no hop** |
| `/video/filmy\|multy\|roliki\|famous-people/` | 3 328 (12.3 %) | 404 — we served `/video?category=<slug>` | **served directly, no hop** |
| `/video/short/` | (in the row above) | 404 | 301 → `/video/` (no such WP category) |
| `/category/*` — `video/*`, `oblast/*`, and ~90 more | 301 (1.1 %) | 404 | 301, whole family |
| `/page/N/`, `/news/page/N/`, `/video/<segment>/page/N/` | ~60 | 404 | 301 → the matching `?page=N` |

**Two shapes deliberately gained no rule:** `/news/<id>` and `/video/<id>`. They were this project's own first cut of the post routes — never public, never indexed, nothing links to them — so they **404** rather than carrying a redirect that would outlive its reason.

**The chosen fix was serve, don't redirect: `/<id>` is the canonical post URL.** What landed:

- **`app/[...slug]/page.tsx`** — a bare numeric segment probes `/wp/v2/posts/<id>?_fields=id,format` (raw `wpFetch`, since a 404 is an expected answer here, `cache()`d so `generateMetadata` and the page share one call) and renders the film page for `format=video`, otherwise the news article. `revalidate=3600`, `dynamicParams`, `generateStaticParams` seeds 20 films + 20 latest posts. **Non-numeric paths `notFound()` — that branch is the seam A6 fills.**
- The two detail bodies were **lifted out of `app/` into `modules/`** (`News/NewsArticle`, `Video/FilmPage`) so the catch-all can compose either; `app/news/[id]/` and `app/video/[id]/` are gone.
- **`/video/<segment>/` are real routes, not redirects** — `app/video/[segment]/page.tsx`, sharing a body with `/video/` via `modules/Video/VideoCatalogue`. `/video/multy/` and `/video/filmy/` are the **#2 and #3 entry pages on the whole site**; sending them to a `?category=` query would have handed crawlers a URL they attribute back to `/video/`. `generateStaticParams` enumerates the four segments and an unknown one `notFound()`s, so `/video/nonsense/` can't become an indexed soft-404 twin of «Все».
- **The redirects live in `src/proxy.ts`** (Next 16's rename of `middleware.ts`; the old filename still works but warns on every boot), driven by a pure **`resolveLegacyUrl(pathname)`** in `src/shared/config/legacyRedirects.ts`. `config.matcher` scopes the proxy to four prefixes, so ordinary traffic never enters it.
- **The same bug twice, caught by curling the built server rather than by types or tests:** a redirect can point at a filter value the destination doesn't recognise and still answer **200** — with unfiltered content. The first cut sent `/video/filmy/` → `?category=581` (the index resolved `?category=` by *slug*), and `/category/novosti/` → `/news/?category=47` (the news index filters by the key `nashi-dela`). Both would have dumped their traffic onto an unfiltered list while every status check passed. `legacyRedirects.test.ts` now asserts no destination carries a numeric id, and that no destination itself redirects.
- **One map, keyed by the URL segment.** `src/shared/config/filmCategories.ts` replaced three copies of the category ids (index, film page, redirect table) — and, once `?category=` was dropped, the slug↔segment indirection that existed only to serve it. `FILM_CATEGORIES` + `resolveFilmCategory` + `catalogueHref` are the whole surface, which also shrinks runbook blocker B5 to four numbers in one file. `src/shared/config/newsCategories.ts` (added 2026-08-13) is the same pattern for news.
- **Why a proxy and not `next.config.ts` `redirects()`.** That table can't emit a slash-terminated destination — Next strips the trailing slash and its own `trailingSlash` normalisation then 308s it back on, making every legacy URL a **two-hop** chain. The proxy returns the already-normalised path, so **every redirected shape is exactly one hop** and the shapes we serve are zero. The two cannot coexist: config redirects run *before* the proxy and would shadow it, so the rules moved rather than doubled up. Bonus from rewriting the pattern strings as a function — `/category/video/movies/page/2/` now keeps the category (the pattern rule dropped it), and page 1 resolves to the bare index instead of `?page=1`.
- **301, not 308.** Both mean «moved permanently» and Google treats them as equivalent, but Yandex — where most of this audience comes from — documents 301 and 302 only and has never confirmed it consolidates signals across a 308. Every URL here is a plain GET arriving from search, so 308's one advantage (no POST→GET rewrite) buys nothing.
- **`trailingSlash: true`** to match the live site's URL form, so those entries are served rather than bounced through a 308 (and a rollback to the old site keeps working).

#### The `/category/*` family — why a catch-all, not an enumeration

The plan read **"`/category/*` — legacy alias of `/video/*` — redirect, don't build"** until 2026-08-13. That was only true of 94 % of it:

| `/category/…` | entries | views | destination |
|---|---:|---:|---|
| `video/*` | 257 | 447 | the catalogue — `/category/video/mult/` alone is **256 entries**, so this one is not optional |
| `oblast/*` (~88 regional archives) | 10 | 31 | `/news/` |
| `novosti/` | 3 | 2 | `/news/?category=nashi-dela` |
| `articles/` | 2 | 1 | `/materials/articles/` |
| everything else — `actual`, `metodic`, Cyrillic slugs like `вс-рф`, `отзывы`, `запорожской-области` | ~2 | ~15 | `/news/` |

The tail is tiny, but it is **~90 distinct slugs and open-ended** — any WP category ever created lands here. So `resolveLegacyUrl` ends its `/category/` branch with a catch-all to `/news/` rather than enumerating: nothing under `/category/` is built, and nothing under it 404s. Page numbers are dropped on the unmapped ones on purpose (page 20 of «Питер» and page 20 of the whole feed are unrelated sets of posts). It also means **`/category/*` never reaches the A6 fallback** — the proxy matcher swallows it first.

#### Verification

`pnpm url:check` (`scripts/check-legacy-urls.mjs`) replays the top-N real entry URLs from the Metrica «Страницы входа» export against any base URL and reports **entry-traffic coverage**, grouping failures by section so "this section isn't redesigned yet" is distinguishable from "the URL shape is broken". `--fail-under <pct>` makes it exit non-zero. This is gate 12 in [`prod-migration-runbook.md` §5](./prod-migration-runbook.md).

**Measured on localhost against od-dev: 83.7 % (2026-08-13), then 84.2 % after the `/materials/articles/` alias** — 125 of the top 200 URLs serve, 17 606 of 20 907 visits. **No URL-shape failures**, which is what A8 set out to prevent. The 15.8 % that 404s is two benign classes:

| 404 group | visits | why |
|---|---:|---|
| `/materials/*` · `/profile/*` · `/contacts/*` · `/about/*` · `/get-involved/*` · `/healthy-*` · `/projects/` · `/team/` · `/actual/` · `/sms/` · `/conf_politics/` · `/faq/` | 3 076 | **not redesigned yet — A6's job.** Ranked exactly as the Tier 2/3 split predicted; Materials is the biggest single group at **1 166**. |
| `/73381/`, `/73084/`, `/72705/`, `/74794/`, `/74557/` | 225 | posts **absent from od-dev**, which is a stale copy of prod (all five return `rest_post_invalid_id`). They resolve on prod. |

**Carry-over:** re-run gate 12 against a real deploy — od-dev is a stale copy, so those five `/<id>` rows can only settle on prod.

### A6. Legacy-page fallback — DONE 2026-08-14

The ~170 pages with no redesigned route are served at their live URLs: `app/[...slug]/page.tsx`'s non-numeric
branch renders `LegacyEmbed`, whose iframe loads `app/legacy/[...slug]/route.ts`, which fetches the page from
`WP_LEGACY_BASE`, strips the old chrome and returns it. Gate 12 went **83.7 % → 98.9 %** entry-traffic
coverage; the residual 1.1 % is three posts missing from od-dev and two `/profile/…` URLs that 404 upstream
too. Full specs and decision record in [`openspec/changes/fallback/`](../openspec/changes/fallback/).

A post-merge review pass added the last 0.1 %: **route params arrive percent-encoded**, and `legacyPath.ts` had
asserted the opposite in prose, so its allowlist rejected every Cyrillic slug — `/profile/дегтярёв-…/` 404'd on
a page that exists. Segments are now decoded exactly once before the allowlist sees them (`decodeSegments`),
which keeps the traversal guarantee intact because `%2e%2e` decodes to `..` and `%2f` to `/`, both of which the
allowlist refuses. Two smaller things from the same pass: the store and the concurrency gate are `globalThis`
singletons, because Next bundles the page and the route handler separately and a module-level instance is
constructed **once per bundle** — measured, one build prints the boot warning three times — which had quietly
doubled both the upstream concurrency bound and the number of upstream renders per page; and `/legacy/*` now
applies the same `isEmbeddable` the page does, so the two surfaces cannot disagree about which paths exist.

A second pass, this time from looking at the thing rather than at the code, fixed three more. Two are the same
mistake — the chrome is gone but what was shaped around it is not: `section#middle` still carried the 130px
`padding-top` that cleared the (`position: absolute`, 130px tall) header, showing as a strip of nothing at the
top of every embedded page; and the newsletter row, on 43 of the 172 pages, still invited a subscription that
LCP-007 and the runtime deliberately make impossible. Both are corrected by one injected `<style>`, last in
the document so it outranks the theme's twelve inline blocks on order rather than specificity. The third:
**a height the parent never heard was never re-sent.** The reporter deduplicated on "same height as last
time", the parent attaches its listener from a `useEffect`, and a cached frame reports before hydration — so
after a back-navigation the frame sat at 540px around 2149px of page, with its own scrollbar already
suppressed on the strength of that unheard report. The settling ticks now force a re-send, and `pageshow`
covers a bfcache restore.

Then the fonts, which is the one place the `<base href>` design does not reach. Fonts are the only subresource
a browser always fetches under CORS, and the legacy origin sends no `Access-Control-Allow-Origin` — correct on
its own site, fatal through ours. Every icon on `/about/`'s cards was missing, because those cards have no
images: the icons *are* `fontello`. So the theme's five faces are relayed through `/legacy-font/*` (a rewrite
in `src/proxy.ts`, allowlisted to `woff`/`woff2` under the theme directory) and re-declared by the injected
runtime against `location.origin`. **Not** `SITE_URL`: it is unset locally and defaults to production, which
*is* the legacy origin, so a build-time origin would have fixed this everywhere except the machine it was
being tested on. This is the deliberate exception to invariant 7, and `e2e` V29 asserts it as one.

**It was never actually blocked on the frozen copy**, which is what the plan had said for two months.
`WP_LEGACY_BASE` points at live production and the proxy removes the chrome itself, so no WordPress-side work
was needed. Swapping to a frozen copy later is one environment variable.

Six things measurement contradicted, all of which had been reasoned the other way first:

- **Remove the chrome, don't extract the content.** Keeping only `section#middle` — the obvious reading —
  discards 34 of `/team/`'s 46 script *elements*, because the `wp_footer` bootstraps sit after `</footer>`.
  That is every cmsms widget, i.e. the only reason to iframe rather than inject. Also: `section#bottom` is
  nested inside `section#page`, so a span finder that returns only outermost elements never finds it and every
  assertion written against it passes vacuously.
- **`?embed=1` is WordPress core's oEmbed card** (21 685 bytes of excerpt, not the page). The hint shipped as
  `?od_embed=1` — which is *not* inert either: it bypasses WP Rocket's page cache, so the upstream serves an
  unoptimised render. Any tooling that diffs upstream against proxied must send the same query or it reports
  phantom losses on every page.
- **`<base>` carries no `target`.** A base target is the default browsing context for every link *and form*, so
  a fragment, a document-relative link or an actionless form would take the visitor's top-level window to the
  legacy origin. Navigation is handled by a delegated click handler instead, and every page link is rewritten
  at transform time so the no-JS floor holds too.
- **The scrollbar suppression lives in the injected script, not in CSS.** As static CSS, a script that fails to
  run leaves a frame stuck at its starting height around a document that cannot scroll — the content is simply
  unreachable.
- **The catch-all page cannot make an uncached fetch.** Its `revalidate` is module-level and shared with the
  numeric branch, so the render must stay statically generatable; `cache: 'no-store'` there aborts with
  `DYNAMIC_SERVER_USAGE` and production answers **500** while `next dev` answers 200. The page surface fetches
  with `next: { revalidate }`; only the proxy route keeps `no-store`. `connection()` does not rescue it. Lint,
  types, 500+ unit tests and 44 browser tests were all green against a build that 500'd on every legacy page —
  a production build is the only gate that catches this.
- **`WP_LEGACY_BASE` must not end up equal to `SITE_URL`.** After cutover this app *is* `obshee-delo.ru`, so a
  legacy origin still pointing there makes every fallback page fetch itself and embed its own shell, one frame
  deeper each time. The app warns at boot rather than refusing, because the two match harmlessly in local dev
  (where `SITE_URL` is unset and defaults to prod).

**Verification.** Three real captured pages under `src/shared/legacy/__fixtures__/` back the unit tests, with
every measured number asserted so a re-capture cannot silently invalidate a decision; `e2e/legacy-embed.spec.ts`
covers the injected runtime in a real browser (the link-classification matrix, form submission, the no-JS
floor, and "the framed document requests nothing from our origin"); `pnpm legacy:sweep` runs the whole thing
against all 172 pages in the legacy sitemap.

**Carry-over:** point `WP_LEGACY_BASE` at the frozen copy when it exists; confirm the container's outbound
HTTPS to that origin; and note that flipping the variable on a *running* container leaves already-rendered
pages in the ISR cache until the window rolls — a real rollback is a redeploy, which starts with an empty one.

---

## 2. Shipped — design system (C)

**C1–C11 are done.** Per-component drift notes live in [`design-system.md` §4](./design-system.md).

- **C1. `Button`** — 2026-05-30 with D1, `src/shared/ui/components/Button/`, maps intent → Radix variant + size. Figma matrix confirmed: 3 Variant (`Contained`/`Outline`/`white`) × 3 Size × 3 State = 27 cells. Canonical Contained/Large: `cornerRadius:9999`, fill `#AE0A04`, padding 12/24, label `text/4/regular`. The `white` variant is the donation CTA on the red header. **The corner-radius question is resolved** — canonical Figma Button is pill, repo Theme is `radius="full"`; the old "5px" reading came from a superseded master (`1321:5304`).
- **C2. `IconButton`** — 2026-05-30 with D1. 2 Radius × 2 Variant × 3 State = 12 cells, 32×32 base. Header-mob search/menu, carousel arrows. **`curved` is 6px, not the 8 the Figma property is named** — corrected 2026-08-13, see the C9 re-review below.
- **C3. `PageHeader`** — 2026-06-03. **Reframed from "hero" to "top-of-page block".** Figma's `page header` (`1335:7682`) is not a banner: it composes header-v2 (instance) + breadcrumbs + page heading (`text/9/bold`, PT Sans Narrow Bold 48, `brand/red/7`) + tabs row. Built as a layout shell rendering optional `<Breadcrumbs>` + the red uppercase H1 + an optional `tabs` slot. The header-v2 instance is **not** re-rendered here — it's the global `modules/Header` from the root layout. Server component. `/news` was refactored onto it, proving reuse.
- **C4. `Pagination`** — 2026-06-03 with D2. Link-based (each page a `<NextLink>`, so RSC with no client JS), windowed range (`getPaginationRange`, pure + unit-tested), prev/next chevrons, ellipsis, active cell `--red-8`, disabled edge arrows, `aria-current="page"`. **Open drift:** cells render 40×40/r8 (measured off the `news` frame instance) vs the canonical component `1326:2018` spec of 36×36/r6. The mobile variant (`1567:12545`) isn't a separate render — the same component flex-shrinks to ≤390 with no overflow.
- **C5. `Tabs`** — 2026-06-03. Figma `_Button Groups Base (tabs)` (`1321:5108`, 12 variants, r8) — distinct from the nav `_Button Groups Base`. **Link-based**, since every confirmed use is URL-driven sub-section switching. All six Figma hexes mapped to existing tokens (`#344051`→`--gray-8`, `#ffeaea`→`--red-1`, `#5c0302`→`--red-10`, `#97a1af`→`--gray-5`, `#f9fafb`→`--gray-1`, `#ffcfcf`→`--red-2`). **Note:** the *controlled client-state* variant for D9's role tabs isn't built — add a `TabsControlled` sibling when D9 lands.
- **C6. `Dropdown`** — 2026-06-04. **Single-select** on Radix Themes `Select`, client component, controlled `value` + `onValueChange`. Faithful to Figma `Dropdown Menu` (`1324:4234`). **Deferred:** the multi-select + checkbox-list + removable-chip variant from the same set — add when Materials needs it. **Not satisfied by the header `ButtonGroupSubMenu`**, which is a Radix `NavigationMenuSub` nav-link flyout — a different component with a different role.
- **C7. `Checkbox`** — 2026-05-30 with D1 (newsletter signup). Figma `Checkbox` (`1323:257`, 12 variants), 16×16, r4, gray-4 stroke.
- **C8. `Carousel`** — 2026-05-30 with D1 (Swiper-backed). Figma provides only the **chrome**: `_Carousel Button Base` (32×32 circle arrows) and `_Carousel Page Indicator Base/Small/Dot` (8×8 dots, active `brand/red/7`). The slider container itself is unspecified.

### C9. Header + footer promoted to the live components — 2026-08-13

`header-v2` (`1229:4371`), `header-mob` (`1248:4486`), `footer` (`838:1631`) and `footer-mob` (`1261:7985`), plus two responsive frames the inventory had never recorded: `footer-1200` (`1621:15559`) and `footer-900` (`1621:15660`). Geometry per component is in [`design-system.md` §3.2](./design-system.md#32-components-defined-on-the--ui-page); what belongs here is what the build found that the mocks don't say.

**Three real bugs, none of them cosmetic:**

1. **Every main-nav link pointed at WordPress.** WP stores main-navigation items as absolute URLs against its own origin, and the header rendered them verbatim — so a click on «О НАС» left the frontend for `od-dev.tmweb.ru`, and would have left prod for the *old site*. `toInternalHref` strips the WP and site origins and leaves genuinely external destinations (`pro.obshee-delo.ru`) alone. This one is worth remembering when any other WP-authored link surface lands: menus, widgets and post bodies all carry absolute URLs.
2. **The footer's social icons never rendered anywhere.** They were painted with `background-image: url(…/vk.svg)` from the module CSS, but `@svgr/webpack` compiles every `.svg` import to a JS module, so the declaration resolved to `vk.svg.<hash>.js` and produced three blank 30px gaps — measured in the browser, and true of the production build too. They are now typed icon components swapped in while parsing the widget HTML, which also gives each link an accessible name.
3. **The footer logo bypassed the image pipeline**, loading straight off the slow WordPress origin — the one rule CLAUDE.md states outright. It goes through `resolveContentImages` now.

**The nav row does not fit below 1440 at Figma's own measurements.** Eight WordPress-authored labels plus three chevrons come to 1126px at `padding: 10px 20px` and 16px labels, and the 1200 tier's column is 1000 — Figma's 1200 and 900 frames both overflow their own column rather than resolve it. The repo steps the label to 14px under `--small-desktop` (Figma's own value) *and* drops the horizontal padding to 8px, then lets the row wrap as a safety valve: the labels are editorial, so a longer one must fall to a second line rather than be clipped. Measured after both: the live seven-cell row (at the time, `navOverrides` hid ОБЩЕЕДЕЛО-ПРО; since 2026-08-15 the entry is deleted in WordPress, so the row is the same seven cells) is **697px against an 860px column at 900**, and 951 against 1240 at 1440 — one line at every width, the wrap never engaging.

**Two of those numbers took a second pass to get right, and the reason is worth keeping.** The 14px step was written as `@media (--small-desktop) { font-size: … }` inside `.base` — which compiled, matched, and did nothing: the cell renders as `<Text size="3" asChild>`, so Radix puts `.rt-Text:where(.rt-r-size-3)` on the same element, `:where()` counts for nothing, and the Radix stylesheet ships after the CSS modules. `padding` in the same block did apply, so the row read as half-migrated and measured 934/783 at 16px. The same trap ate the logo lockup's tracking and leading against `.rt-Text`. **Any single-class rule that competes with a Radix prop loses on source order** — double the selector (`.base.base`, `.logo .name`, `.link.primary`) whenever a Radix component owns the same property.

**«ОБЩЕЕДЕЛО-ПРО» was hidden by label, not by URL** — *historical; superseded 2026-08-15,* when the menu item was deleted in WordPress on both installs and `navOverrides` was removed with it (see [`next-steps.md`](./next-steps.md)). The reasoning is kept because it applies to the next entry someone wants to hide: prefer deleting it at the source, and if that isn't possible, match the label. It is a sibling property the site doesn't advertise yet, so `navOverrides` drops the entry on the way through and `SHOW_PRO_IN_NAV` is the one switch that brings it back. The label is the key because it is the part that stays put: od-dev and prod carry the *same* menu item (56658) under the *same* label, at **different addresses** — od-dev an old `.рф` domain whose DNS no longer resolves, prod `od-pro.ru`, which is live but serves «Всероссийский конкурс социальных проектов», the contest landing rather than the property itself (`pro.obshee-delo.ru`, «В начало | ОбщееДелоПРО»; all read 2026-08-13). Matching on the destination instead would have put that list of stale addresses in the repo and on the `WP_BASE`-repoint checklist, and it fails open — an entry that matches nothing simply comes back into the header.

**The footer keeps its data path.** The content is still the `sidebar_bottom` widgets, in WordPress's order — only the presentation is the component. Raised and rejected: a typed config file. It would have read better and survived the B8 plugin purge outright, but it takes the footer links away from editors to solve a problem that doesn't exist yet, and the widget markup turned out to be clean Gutenberg (`wp-block-list`, `wp-block-heading`) with the CMSMasters classes confined to the three social anchors — which no longer render through them.

**`--tablet (width < 1200px)`** landed with this (half of A1b), *added* rather than renamed so the existing max-width tiers keep nesting. Note the two thresholds differ: type steps down at 1440, padding at 1200.

Still presentational: the header search field. `fetchSearch` exists (B7), a `/search/` route does not, so submitting it would only 404.

#### Re-review against the `👉 UI` page — 2026-08-13

A second pass measured the shipped header, footer and `Links` against every node again rather than against the first pass's notes. The colour matrix, the token scale (`brand/red/1-10` and `gray/1-10` match `theme-override.css` hex for hex), the flyout, the drawer, the footer grid and all the hover states came back clean. Four things did not, and **three of the four were rules that compiled, matched and lost** — the same specificity trap as the 14px label, which is now the failure mode to look for first:

1. **A `border` grew the nav cell past the spec.** `.base` carried `border: 1px solid transparent` so the hover hairline wouldn't shift the row, which put every cell at 44.41 against Figma's 42 and the whole bar at **131.91 against `header-v2`'s 128**. Figma's own frame stays 142×42 with the stroke on, so the stroke is inside the box: `box-shadow: inset 0 0 0 1px` on hover, no border at rest. Now 42.41 / 129.91 (the last 1.9 is three lines of logo at `line-height: 130%`), and the cells are 2px narrower each, which the row below 1440 can use. Figma's active state has no stroke at all, so `.baseActive` doesn't carry one either.
2. **`IconButton`'s curved radius rendered 4px.** `.radius-curved { border-radius: 8px }` was one class against Radix's own radius rule and lost, and 8 was wrong regardless: the `Icon Button` set names the option `Radius=Curved (8px)` and draws all twelve variants at **6**. The rule is doubled with the class that always accompanies it and reads `var(--radius-2)` — which meant mapping `curved` to Radix `radius="large"`, because `data-radius="medium"` rescales that very token to 4px on the element it sits on. Only the two header buttons were affected (the carousel passes `circle`), and a test now pins the mapping since nothing in the rendered class names would show it.
3. **The mobile search button had no hover state.** It was styled as a white hairline over a `transparent` fill, which reads correctly on a red-8 bar but overrode the variant's hover along with it. Figma draws it as the **Contained** variant plus a ring (`1327:14557`), so it now *is* Contained — and Radix's solid hover is red-10, exactly `1327:14605`.
4. **The flyout rows were only as clickable as their text.** `ButtonGroupSubMenu`'s `.link { display: block; width: 100% }` lost to `Link`'s own `.link { display: inline }`, leaving a 109px target in a 185px row.

Deliberately left alone, all cosmetic and all now in [`design-system.md` §4.3](./design-system.md#43-open-questions-to-raise-with-design-none-are-blockers): the search glyph is `red-1` where `header-v2` alone says `gray-1`; the footer's four columns are `repeat(4, 1fr)` where Figma's pitch puts the fourth 19px further right; the WordPress legal notice is underlined where Figma shows plain text; the input's right padding is 20 against Figma's 15. One non-Figma nit: the header logo is `loading="lazy"` on an above-the-fold element — `priority` would be better, but `Logo` is shared and the change belongs with a look at LCP, not here.

### C10. `Modal` → Radix Dialog — 2026-08-13

The custom portal had click-away, Escape and a body-scroll lock, but could not trap focus and left the page behind it in the accessibility tree. Both come free from Radix's Dialog — and **with no new dependency**: `@radix-ui/themes` already ships one, so the `@radix-ui/react-dialog` the plan assumed was never needed, and `@uidotdev/usehooks` (whose only consumer was `useClickAway` here) is gone.

Two things the swap had to restate: Radix's content panel is a padded white card, which a lightbox is not, so its chrome is reset; and `--color-overlay` now carries the 80% scrim the old overlay painted, against Radix's 40% default. `title` is required and rendered visually hidden — a dialog with no accessible name is the one gap the library cannot fill for you.

**There is no dialog, modal or lightbox anywhere in the Figma file** (searched again 2026-08-13), so unlike C9 and C11 this one had nothing to measure against: every decision here is behavioural, and the 80% scrim is the only visual choice, inherited from the component it replaced.

### C11. `Link` aligned to the `Links` matrix — 2026-08-13

`color` is `primary | red | white` — Figma's three — plus `gray`, kept deliberately for the *separate* `_Breadcrumbs Base` component and consent copy. `lightgrey` was a duplicate of `gray`; `darkgrey` was `primary` with the wrong hover. All four states including disabled; the full matrix is in [`design-system.md` §3.2](./design-system.md#the-links-colour-matrix).

**Extra Small and Small are byte-identical in the component set** (both `text/3`, 16px), so the repo keeps the Radix `size` prop rather than inventing a third step.

**Every colour selector is doubled (`.link.primary`).** `theme-override.css` paints `.rt-Text:where([data-accent-color])` red-8 and every `.rt-Link:hover` red-10; `:where()` contributes nothing, so those are one class each — a lone `.primary` ties and loses on source order. It was measured rendering red-8 before the fix, which is the sort of thing only a browser tells you.

---

## 3. Shipped — pages (D)

### D1. Home (`app/page.tsx`) — 2026-05-30, reviewed and signed off 2026-06-01

Figma reference frames on the `design` page: `home` 1440 (`3614:91040`, canonical desktop — re-pasted 2026-05-30, old `889:3761` parked off-canvas), `home` 900 (`1622:10641`), `home-mob` (`1356:15986`), plus `главная` (`3612:11235`) as an exploration board. Composition in [`page-mocks.md` §2.1](./page-mocks.md#21-home-top-level-frames-no-section-wrapper) — nine sections shipped as Hero, StatsRow, FilmsCarousel, NarrowPromo, Directions, Programs, NewsGrid, NewsletterSignup. Async RSC with `revalidate=3600`; pulls `?format=video` for the films carousel and the latest 4 posts for the news grid. C1/C2/C7/C8 landed alongside; NewsCard + NewsletterSignup were lifted as shared modules for D2/D4/D7/D8 reuse.

**Review pass 2026-06-01:** wired all CTAs (Hero donate → external donation URL, participate → `/get-involved`, Films→`/video`, News→`/news`); fixed the Hero mosaic grid bug (tiles with no slot were 0-height phantoms); film thumbnails moved to `next/image`; Directions/Programs/FilmsCarousel dropped `'use client'` (server components now, only the inner Carousel is client); newsletter email got an accessible name; StatsRow became a `<ul>/<li>`; Header `/test` placeholders repointed; CTA labels set to «Все фильмы» / «Все новости». The dev-only Radix hydration warning was confirmed **absent in production**.

**Deferred, not D1-blocking:** Directions/Programs entries stay hard-coded pending #32 (sections-fetch); the proper 900-tier landing is A1b; the `/materials` nav prefetch 404 clears when D8 ships. The 900-wide variant currently uses the desktop layout collapsed via the 3-tier breakpoints.

*Resolved along the way:* the 5-vs-3 directions question — 5 is correct; the canonical frame just clips overflow cards.

**Programmes and directions are one carousel (2026-08-14).** Three of the five directions point at pages that 404 on the legacy origin, so they are hidden and the two carousels were merged under «Программы и направления деятельности» — a two-card carousel reads as a stub. That started as a runtime switch (`MERGE_HOME_SECTIONS`) over two components, but `Programs` was a byte-identical copy of `Directions` bar its illustration list and heading, and the switch could only ever be `true` from static config. Both are gone: `app/page.tsx` renders one `Directions` over `[...PROGRAMS, ...DIRECTIONS]`. If the missing pages ship and the split comes back, it is the same component rendered twice with different props — which is exactly what `/projects/` does (D6 below).

**…and split again on 2026-08-15,** once «Онлайн курсы» made three directions. The switch is `SPLIT_HOME_SECTIONS = DIRECTIONS.length >= 3` — three is a full row at desktop, which is the point where the carousel stops reading as a stub, so the page follows the config instead of being re-decided by hand. Two `Directions` with `PROGRAMS_TITLE`/`DIRECTIONS_TITLE`; the merged heading stays for when directions thin out again. Also 2026-08-15: **all three home section headings corrected to PT Sans Bold 32/24** (`text/8/bold`, e.g. `3614:91093`) — `Directions`, `FilmsCarousel` and `NewsGrid` all shipped at 48 PT Sans Narrow, which no Figma frame draws.

**GitHub:** pre-decomposed into #33 Hero, #34 Statistics, #35 Films carousel, #36 Banner, #37 Programs carousel, #38 Articles, #39 Subscribe — all now have shipped markup. **#32 (open)** still tracks "how do we fetch sections" (working assumption: widgets).

### D2. News index (`app/news/page.tsx`) — 2026-06-03

Frame `753:418`. Async RSC, `revalidate=3600`, **dynamic** (driven by `?category=` / `?page=`). Breadcrumbs + red uppercase `НОВОСТИ` H1 + filter chips + a 3-column `NewsCard` grid (15/page → 3 cols desktop / 2 small-desktop / 1 mobile) + C4 `Pagination` + `NewsletterSignup variant="card"`.

Data via `fetchNewsList` (`src/shared/api/fetchNewsList.ts`) — paginated `/wp/v2/posts` reading `X-WP-Total{,Pages}`, optional `categories` filter, thumbnails through `resolveMediaUrl`, hour-cached, returns empty on a non-2xx (WP 400s an out-of-range page) rather than throwing.

**Filter chips** (`src/modules/News/NewsFilter/`): `Все` = unfiltered · `Наши дела` → category `Новости` (47) · `Статьи` → `articles` (578). There is no dedicated «Наши дела» WP category, so it maps to the main news category. Ids live in `src/shared/config/newsCategories.ts` since 2026-08-13.

**GitHub:** newsletter *submission* wiring still open (#54); markup side is #66/#39.

### D6. Projects index (`app/projects/page.tsx`) — 2026-08-15

Figma: `projects` (`706:1775`). **Index only** — the three `project-1/2/3` detail mocks stay unbuilt, and the plan's reason holds: zero `/projects/<slug>/` URLs in 91 days, and the `project` CPT is 21 Lorem-ipsum drafts (B-CPT). The index itself is worth building — 794 views / 85 entries, **9.3×**, the section's whole traffic.

**Nothing is fetched.** The cards are the same two arrays the home page reads, renamed `shared/config/homeSections.ts` → **`programSections.ts`** (`PROGRAMS`, `DIRECTIONS`, plus `PROGRAMS_TITLE`/`DIRECTIONS_TITLE`) now that two surfaces read them. So the hiding rule is one rule: a card absent from `DIRECTIONS` — «Бизнес-клуб», «ОД ИТ», «Наставничество», all three 404 upstream — is absent on the home page *and* here. Adding one back is one line and lights up both.

**The two sections stay apart here, unlike the home page,** and they are **static grids, not carousels** — the mock draws rows of fixed cards with no arrows or dots. The home merge into «Программы и направления деятельности» exists because a two-card carousel reads as a stub *above the fold on the landing page*; on the page whose subject is the list, a short section is a list. New `CardSection` (grid + optional heading); the home `Directions` keeps the carousel. It started as `modules/Projects/ProjectsSection` and moved to `shared/ui/components/CardSection` on 2026-08-15, when `/materials/` turned out to want the same rows — see D8 below.

**The mock's labels are not the home page's.** The H1 is «ПРОГРАММЫ» (`page header`'s Header text, PT Sans Narrow Bold 48 — agreeing with the live site and Figma's own nav), the programme row under it carries **no heading of its own**, and the second section is headed **«Проекты»** — not «Направления деятельности», which is the home page's name for the same five cards. That is what settles the plan's label question: both words are right, on different lines of the same page. The programme grid still passes its title as the section's `aria-label`, so it is a named region without drawing a duplicate heading.

**Section heading here is PT Sans Bold 32** (`text/8/bold`), not the 48 PT Sans Narrow the home sections shipped with. **Home was the one off-mock** — all three of its section headings were corrected to match on 2026-08-15 (see D1).

**The illustrations were being cropped, not scaled, below ~1170px.** svgo's `preset-default` drops `viewBox` when the SVG also carries width/height, so every `direction-*.svg` reached the browser without one: the element resized, the artwork did not. Fixed in `next.config.ts` by passing `svgoConfig` with `removeViewBox: false` to the svgr loader — it applies to every SVG in the repo, not just these cards. The card's own `svg` rule went with it (`width: 100%`, since a flex item's `min-width: auto` is its intrinsic 335px and `max-width` alone never shrank it).

**Cards are now paired to drawings by name, not position.** Figma gives each card a fixed illustration on both pages — «Общее дело ПРО» is the charts drawing in `projects` *and* in home's `Направления деятельности` (`3614:91189`) — but the code held a positional `ILLUSTRATIONS` array, so the home page drew the wrong picture for it, and `/projects/`'s two sections both restarted at `direction-1`. Each card in `programSections` now carries its own `Illustration`, and three drawings that had no asset (the programmes': `healthy-russia`, `healthy-kids`, `healthy-youth`) were exported from `706:1775` as SVG. `direction-1/4.svg` are now unreferenced — they belong to two of the three hidden cards; `direction-3.svg` («ОД ИТ») was later taken over by «Онлайн курсы».

The card itself moved to `shared/ui/components/IllustratedCard` (both shapes render it) with the mock's metrics: 12px radius, 25 padding, a 200-tall illustration box, 45 to the body, 10 between title and link — 385×358 at three-up.

`PageHeader` with no breadcrumbs row (the mock omits it here, unlike the per-project pages — the component's own doc already called this the example case), then the two sections, then `NewsletterSignup`. Fully static: no `revalidate`, no WP call. Seeded into `sitemap.ts` (`monthly`, 0.8).

**Being a real route retires the A6 fallback for `/projects/`** with no other edit — App Router precedence over `[...slug]`.

**Row shape is derived, not authored (2026-08-15).** The mock draws two card shapes — three portrait cards to a row, or two wide 598×280 ones with the drawing beside the text (`Frame 33845/33846`) — and splits its five project cards 2 + 3. Hard-coding that split would break the moment a card is hidden or restored, which is the one thing this config exists to do, so `toCardRows` derives it: rows of three, with the remainder spent on wide rows *first*. 5 → 2 + 3 as drawn, 4 → 2 + 2, 6 → 3 + 3, and no row is ever left short. It runs once at render, off static config — a browser resize does not re-split, and shouldn't: the card *count* is what picks the shape, and that only changes on deploy. Rows keep their column count down to `--mobile` for the same reason; dropping a three-card row to two columns would strand its third card rather than reflow anything. The wide card is `IllustratedCard`'s `wide` prop — `row-reverse` (the drawing is right of the text, the opposite of the markup order), body stretched with title top / link bottom, collapsing back to the portrait shape under `--mobile`, where the row is one column anyway.

**Card heading level follows its section.** `IllustratedCard` takes `headingAs`, and `CardSection` derives it: `h3` under a drawn section heading, `h2` where the section draws none and the page's H1 names it (the programme row here, and all four cards on `/materials/`). An H1 → H3 jump is a heading-order failure, and the level is derivable, so no caller passes it.

**«Онлайн курсы» (2026-08-15)** is a sixth card, added to `DIRECTIONS` at the client's request and absent from the mock. It points at `edu.obshee-delo.ru` — no page for it exists on the legacy origin or in WP — and borrows «ОД ИТ»'s drawing (Figma's «Digital learning», `direction-3.svg`), which is why restoring «ОД ИТ» now needs a drawing of its own rather than just a line of config.

### D6b. Native WP pages — WordPress content at its own URLs, 2026-08-15

The `/projects/` cards point at three programme pages, and those pages are not a template to design: they are **WordPress pages that already exist at the URLs the live site serves them from**. So they are rendered as such — and since nothing about that is specific to them, it is the **default for every path the catch-all reaches**: WP is asked for a page at that path, and renders it if there is one. No route, no component, no content migration per page, and **no URL change**, so entries and rankings are untouched while editors keep working in WP. ~150 pages came online with nothing to configure.

The three parts:

- **`shared/api/fetchWpPage.ts`** — resolve a page by the path it is served at. WP's REST API has no path lookup, so this queries `?slug=<last segment>` and then **verifies `link` against the requested path**: `?slug=` matches the last segment anywhere in the tree, so `/materials/plakati/` and a hypothetical top-level `/plakati/` would otherwise answer for each other. Raw `wpFetch`, not the typed client, because "no page here" is an expected answer and the client's middleware throws on non-2xx. Tagged `wp:pages`.
- **`modules/WpPage`** — a news article without the news furniture: `resolveContentImages` → `parsePost` → `GutenbergProvider`, a `PageHeader` on top (a WP page carries its title outside the body), no date and no similar-posts rail. That pipeline is shared, not copied — and the fourth consumer is what moved it out of `modules/News`, where three other modules were already reaching in: it now lives in **`shared/lib/wpContent/`** (`parsePost`, `resolveContentImages`) and **`shared/ui/components/ImagePreview/`**. Names kept as they were; `parsePost` parses pages and films too, but renaming it is churn for no reader.
- **The catch-all** runs the path-shape guard (`isEmbeddable`) **first**, so `/favicon.png/` and `/legacy/…` cost no round trip, then asks WP, then **falls through to the embed** when WP has no published page there. That last fallthrough is what makes the default safe: "not in WordPress" is an ordinary answer, not a 404.

**Opt-out rather than opt-in, and the exception list is short.** Measured 2026-08-15 over all 174 published pages: 165 are Gutenberg blocks, and the only shortcodes left anywhere are WooCommerce's — `cmsms-gutenberg-upgrade` has already run on od-dev (see `CLAUDE.md`). What 23 pages still carry is bare `cmsms_*` class names, which only mean something under the old theme's CSS, which is exactly what the iframe still supplies. `shared/config/legacyEmbedPages.ts` was those two groups: the four WooCommerce pages (`/cart/` is literally `[woocommerce_cart]`, and REST hands shortcodes over unexpanded — natively it would print the brackets), and the cmsms 23 minus six. The WooCommerce four were **deleted in WordPress on 2026-08-17** and their entries dropped — see [`wp-page-passthrough.md`](./wp-page-passthrough.md) §7. The six: the three programme pages, whose residue is a heading class on three closing links and which were checked in a browser at 1440 and 375; and `/`, `/news/`, `/video/famous-people/`, which are native routes and never reach this catch-all at all.

The scan that produced the list is worth repeating rather than trusting: its first pass looked for a fixed set of shortcode names and reported zero, missing WooCommerce entirely, and a generic `[word]` regex then flagged 25 pages — 22 of them false positives, `wysija[user][email]` form-field names from the newsletter widget. The list above is the third pass.

**What the inversion costs:** one WP request on any path that turns out not to be a page, before the embed loads — cached for an hour under `wp:pages` and bounded by the route's own ISR window. What it buys is that a new WP page is live at its URL the moment it is published, with no deploy.

**The sitemap enumerates the pages** (`/wp/v2/pages`, two requests, exceptions and static-entry duplicates filtered out). It has to: the live site's sitemap comes from a WP plugin and 404s the moment the frontend takes the domain, so without this a page nobody links to simply drops out of the index. Paths keep WP's percent-encoding there, because `<loc>` must be URL-escaped, while the exception list is matched decoded — the same form the route compares.

**Two bugs the first page found, both fixed in shared code rather than here:**

- **Every image was broken.** The block editor writes `src="/wp-content/uploads/…"`, root-relative — which resolves against *our* origin and 404s. `resolveMediaUrl` assumed an absolute URL; it now gives a root-relative (or protocol-relative) src the WP origin before anything else, so every caller benefits, not just page content.
- **The lightbox had never worked at all**, on any page. `ImagePreviewClient` attached its handlers by walking `children` with `cloneElement` — which passes a unit test and finds **nothing** in the browser, because the content arrives across a Server Component boundary (`GutenbergProvider` around `parsePost`'s output) that a client component cannot introspect. Measured: 0 of 19 images on a news post carried the handler. First diagnosed as a missing `preventDefault`, which was a symptom of the same thing: the click was never being handled, so the `<a>` WordPress wraps media images in simply navigated — to a 404, since that href is root-relative and resolves against our origin. Rewritten as one delegated listener on a wrapper, which does not care how the subtree was produced. Only media links are hijacked (`/wp-content/uploads/` in the href, or no link at all); an image linking to a page stays a link.

  Once it opened, it wouldn't close: the dialog was a fixed 90vw × 90vh box with a `fill` image letterboxed inside it, so the grey beside a portrait picture was **dialog**, not overlay, and a click there — the natural place to click to dismiss — hit nothing. Only the last few pixels at the viewport edge worked. The dialog is now exactly the size of the picture: dimensions are read off the clicked thumbnail (`naturalWidth`, falling back to the laid-out size), the modal panel is `width: fit-content`, and the image is capped at 90vw/90vh with `width`/`height: auto` so it scales down but is never upscaled past its own pixels. `priority` on it, too — the default lazy loading left the panel collapsed to zero until the file arrived, which read as a beat of nothing followed by a pop.

`stripHtml` gained a related fix: a tag now becomes a space rather than nothing, because `<p>a</p><p>b</p>` and a `<br>`-broken title are two words and it was gluing them into one — visible in page titles first, but meta descriptions had it all along.

**A third bug, from the tile pages: a WP body brings its own `<style>`, and ours was fighting it.** `/materials/printed-products/` and `/materials/social-reklama/` lay a caption over each picture with `.textcapt { position: absolute; top: 15px; left: 17px }`. Two things went wrong at once, both in `gutenberg.css`:

- **The captions left the page.** An absolutely positioned element needs a positioned ancestor; on the old site that was the theme's `.cmsms_column`, and Gutenberg's `.wp-block-column` is static, so every caption resolved against the document and stacked in the top-left corner **over the header**, leaving the images captionless. `.wp-block-column` is now `position: relative` — the old anchor, restored without the frontend knowing anything about the page's CSS.
- **Then they came back grey.** The page colours the *column* (`.redcapt`), and our `.wp-block-columns p { color: var(--gray-7) }` (from #62) matched the paragraph itself — an inherited colour always loses to a direct rule. That rule is deleted: its `font-size` duplicated the base `p` rule, so the colour was all it did, and a WP page's own styling should win inside its own body.

**How far that class of bug reaches, measured 2026-08-16 over all of od-dev:** 2 247 of 8 241 posts carry an inline `<style>` and **none** of them positions anything absolutely; 30 of 174 pages do, and **7** position something. Of those seven only three reach this renderer (`/materials/printed-products/`, `/materials/social-reklama/`, `/get-involved/share-knowledge/` — and the third positions its own parent, so it was never broken); two are on the opt-out list and two are shadowed by native routes. That asymmetry is the whole reason a post renders and a page doesn't: the pipeline is identical, the content isn't. The full walkthrough — both branches of the catch-all, the three stylesheets, the safety argument for the `position: relative` rule, and the checklist for a page that renders wrong — is [`wp-page-passthrough.md`](./wp-page-passthrough.md).

**Still broken on those two pages, and not fixable here:** the migration repointed every tile's link at the image file (`/wp-content/uploads/…jpg`) where the live site links to the child page (`/materials/books/`, `/zakladki/`, `/booklet/`, `/disk/`, `/autosticker/`, …). So the tiles open a lightbox instead of navigating, and the grandchild pages lose their only inbound link. It is content, not code — the fix is in WP (or in `cmsms-gutenberg-upgrade`, since prod will migrate the same way). The `.image` wrapper class went the same way, which is why the tiles are white with full-brightness pictures rather than the grey dimmed panels the live site draws.

### D6c. WordPress-origin links rewritten in every body — 2026-08-17

WordPress renders **absolute** hrefs. A page's `wp:query` loop arrives from REST with `href="https://od-dev.tmweb.ru/<id>/"` on every card (measured on `/contacts/chukotskiy-ao/`), and editors paste the same shape by hand. Images were already handled — `resolveContentImages` rewrites `<img>` and strips `srcset` — **links were not**, so clicking a news card on a regional contacts page walked the visitor off the frontend and onto the CMS, which on production is the old site. **86 of 170 published pages carry a `wp:query`**, ~80 of them the regional `/contacts/*` template.

Fixed in the pipeline, not in the content: the markup is generated by WordPress at render time, so no editor and no migration script can reach it.

- **`shared/lib/wpContent/resolveContentLinks.ts`** — pure and synchronous, over `<a>` tags only. It reuses **`toInternalHref`**, which already did exactly this job for the header menu and has moved from `modules/Header/utils/` into `shared/lib/wpContent/` so both callers can share it (shared code cannot import from a module). Internal means the `WP_BASE` origin or `SITE_URL`; everything else — external hosts, lookalike hosts, relative hrefs, `mailto:` — passes through untouched.
- **WordPress's own trees are the exception.** `/wp-content/`, `/wp-admin/`, `/wp-includes/`, `/wp-json/`, `/wp-login` keep their origin: a linked PDF under `/wp-content/uploads/` exists on the WordPress host and nowhere else, so making it root-relative would turn a working download into a 404. This is the one case where leaving the CMS is correct.
- **`resolveContentHtml`** composes the two halves and is now the pipeline's entry point, ahead of `parsePost`. All four consumers moved onto it — `WpPage`, `NewsArticle`, `FilmPage` and `Footer` — so a body cannot reach the page with only its images fixed. The footer picked up the link rewrite for free; its widgets carry absolute WP links too.

Twelve tests in `resolveContentLinks.test.ts`, including idempotency and the `wp-content` and lookalike-host cases.

**Verified against live od-dev the same day**, once a route to the host was found (it times out from some networks — see [`wp-page-redesign.md` §5](./wp-page-redesign.md#5-prerequisites-and-things-that-break-outside-this-file)). All 169 published pages were rendered server-side through `the_content` and the real function run over the result: **3 899 anchors, 1 830 of them WordPress-origin, 4 left after** — and those 4 are `/wp-content/` links kept deliberately. 736 external links untouched, output idempotent. Of the rewritten ones 1 816 land on `/<id>/`, which is exactly the catch-all's numeric branch.

Two things that measurement turned up. One was a false alarm: 170 links to `/date/YYYY/MM/`, a route this site has no answer for, all from a single scratch page (`72892 test`) carrying a `core/archives` block. The other was real, and is D6d below. Worth remembering **how** they were nearly missed — WordPress emits `href='…'` from some blocks and `href="…"` from most, and a double-quote-only grep reported a confident zero.

### D6d. Root-relative `/wp-content/…` links given their origin back — 2026-08-17

The mirror image of D6c, found while verifying it. Where D6c takes an absolute WordPress URL and drops the origin, these hrefs never had one: WordPress stores what an editor inserted as `/wp-content/uploads/2020/04/22-scaled.jpg`, which is correct inside WordPress — the page is served from that host — and a 404 here, where it resolves against our origin. Measured on od-dev: **12 724 such hrefs across 5 052 published posts, 286 across 37 pages.**

Same predicate, run the other way: `WP_ONLY_PATH` already existed in `resolveContentLinks` to keep *absolute* `/wp-` links from being made relative, and now a root-relative one gets `wpBaseUrl` prefixed instead. Four lines. It stays in the pipeline rather than `od-pages.php` for two reasons — at 13 000 links it is not a content edit, and code covers posts as well as pages with nothing to run against production.

**This is not a new idea in the codebase**: `resolveMediaUrl`'s `absoluteWpUrl` has done exactly this for `<img src>` since D7, which is why images were never broken and only links were. The two halves now agree.

Verified over the same rendered corpus plus 400 rendered posts: root-relative `/wp-` hrefs **290 → 0** on pages and **20 → 0** on posts, no link left pointing off-site, idempotent on both.

### D6e. `/healthy-russia/` rebuilt on the `project-1` template — 2026-08-17

The first page redesigned under the flow in [`wp-page-redesign.md`](./wp-page-redesign.md), and the first use of `wp/scripts/od-pages.php`. Figma `project-1` (`759:845`); the page is WP post **60050**, native since D6b.

**What the migrator left.** Six full-width `wp:group`s of `wp:columns`, with every heading and paragraph collapsed into a single `wp:paragraph` block of raw HTML (`<h2 class="cmsms_heading">` and all), a `wp:separator` between each image and its button, and four trailing `<h3>`s — three of them headings with nothing under them on the live site either, one a link.

**Where each difference went**, by the ladder in the flow doc:

- **Content → `od_pages_healthy_russia()` in `wp/scripts/od-pages.php`.** The card layout is structure, so the transform reads the page's own images, links and prose back out and re-emits them as real `core/heading`, `core/paragraph`, `core/image` and `core/buttons` blocks tagged `od-programme-logo` / `od-card` / `od-cards` / `od-card--flush` / `od-poster-cards`. Volatile values — attachment ids, upload paths, the four film post ids — are **extracted, never hardcoded**, because they differ between od-dev and production. Idempotent by detection: the transform returns the content untouched once it carries `od-card`, so a re-run never clobbers an editor. Two content wins fell out of it: every poster now links to its film instead of to the JPEG, and every image has alt text taken from its own button.
- **Design → `gutenberg.css`.** One block on the classes above, all in existing tokens (`--white`, `--red-8`, the `--font-size-*` scale, radius 12/16 from the mock). Nothing is page-specific: `/healthy-kids/` and `/healthy-youth/` get the same treatment from the same script. Every number is **read off the mock's geometry, not eyeballed from its screenshot** — content column 1240, blocks 120px apart, a section heading 45px above the row it introduces, the goal card's 640 + 572 split, the methodology card's 386 + 40 + 774. The rendered page now measures those to the pixel.
- **The goal card's drawing** (Figma `Supporting volunteering`, `759:850`) is decoration, not content, so it is a CSS background from `public/figma/programme-goal.svg` rather than an image block — there is nothing there for an editor to delete by accident, and no upload to repeat on production.

Also fixed in passing: `.is-style-outline:hover` painted white text on a near-white background — invisible on hover, on every outline button on the site.

**Deliberate deviations from the mock**, both worth a word with Design:

- **The red `<h1>` stays.** The mock replaces the page title with the programme's logo card; `PageHeader` is the site-wide convention and the H1 is what search sees. Removing it is a one-line change if Design insists.
- **The poster cards are labelled with the film's title, not «Подробнее».** The mock draws that pill on the active card only, and none at all on mobile. Six identically-named links would read badly, and the title is the accessible name the card needs anyway — see the stretched link below, which is what lets the pill be a label rather than the only hit area.

**Both rows are carousels — `cb/carousel-v2`, the Carousel Block plugin.** Which is what both mocks draw: the desktop mock puts arrows and six bullets under «Проекты программы», and the mobile mock (`1261:7505` — same frame name as the desktop one, a second hit in `search_nodes`) turns **both** rows into 280px-wide swipes. Nothing new runs on the frontend for it: `GutenbergProvider` already mounts a Swiper on every `.cb-carousel-block` it renders, and `Carousel/custom-carousel.css` already draws the mock's 32px round arrow and 8px bullet. So the sections are carousels in `post_content`, and a fourth task or a seventh project is a slide an editor adds — no markup change, no CSS change. Above 900px the adapter takes `slidesPerView` from the block (3, which is the desktop layout exactly: 387 + 40 + 387 + 40 + 387 = 1241); below it, `slidesPerView: 'auto'` reads the 280px width out of the stylesheet. «Задачи» carries `navigation: false` and hides its bullets above 900px, because on desktop all three cards are already on screen and the mock draws no controls.

**«Проекты программы» is a query over a tag.** It used to be four `core/image` blocks the migrator left, hand-picked; it is now `core/query` filtered by **`programma-zdorovaya-rossiya`**, so tagging a film in the admin puts it on the page and nothing here changes. The tag is ours — **nothing in the inherited model said which films the programme is**: the candidates all sit in category `movies` (581) and share nothing else, and the tag that reads like the programme's, **72** «Здоровая Россия - Общее дело», is on ten *news* posts from 2015–16 and on no film at all. `wp/scripts/od-wp.php` creates it and applies it ([`wp-backend.md` §3.2](./wp-backend.md)) — it was `od-terms.php` until D6f widened it.

Three details make a dynamic list drive a Swiper, and none of them is a hack:

- The query renders as `<div class="wp-block-query">`, so it takes `className: swiper` and becomes the element the adapter mounts on. `core/post-template` renders the `<ul>` Swiper needs as its track, so it takes `swiper-wrapper`. The `<li>`s come out as `.wp-block-post`, which is the *one* line this needed on the frontend — `CarouselAdapter` passes it to Swiper as `slideClass`.
- **Permalinks here are `/%post_id%/`**, so every link a query block emits — `https://od-dev.tmweb.ru/19864/` — is already the URL this frontend serves a film at. `resolveContentLinks` makes it root-relative and that is the whole of it.
- The cover is **not** `core/post-featured-image`. A film needs two covers — a 16∶9 still for `/video/` and a portrait one for a 3∶4 programme card — and a post has exactly one featured image. So the card binds a `core/image` to postmeta through the **Block Bindings API**, which is the only way to read a custom field inside a query loop without writing a block. A binding cannot produce a permalink, so the cover is not a link and the film's title is, which is the better accessible name anyway. (Worth knowing for the next such block: `core/post-featured-image` writes `object-fit` **inline**, which no stylesheet can beat, and its default is `cover` — a still cropped to portrait, title and all.)

**The second cover is `wp/mu-plugins/od-film-meta.php`**, the first mu-plugin this workstream has needed. It registers one meta key — bindings only read *registered* keys, and this site had exactly one, core's `footnotes` — and computes it on read: **`od_card_cover`** is the film's printable плакат (`poster_image_url`, portrait, already in `group_film_meta`), falling back to the featured still. A separate key rather than `poster_image_url` itself, because that field means «the printable плакат» to `FilmPosterCard` on the film page and synthesising a value would make every film claim to have one — and because a card must not break on a film that has none. Three of the six tagged films have a плакат today and show it full-bleed; the other three fall back, and uploading a плакат upgrades a card with nothing else to do.

Two content gaps it exposed. The films' covers had **no alt text at all**, and a linked image with no alt is a link with no accessible name — `od-wp.php` now names each one after its post, which helps everywhere those covers render. And **three of the nine lesson films have no post on the site**, under any title, in any video category: «Влияние алкоголя на репродуктивную систему человека», «Алкоголь. Взгляд изнутри», «Наркотики. Медицинские и социальные последствия». The registry's docblock names them, so adding a slug is the whole job once they exist. The alcohol lesson meanwhile exists twice — **63287** «Алкоголь. Секреты манипуляции» (2021, has downloads, tagged) and **19871** «Секреты манипуляции — Алкоголь» (2016, no downloads) — with different Kinescope ids, for content to settle.

**The whole card is the link, not just the pill.** One anchor still — the title's — stretched over the card by `a::after { position: absolute; inset: 0 }`. That needs the card to be the anchor's only positioned ancestor, so the pill is laid over the artwork with **grid** rather than by positioning it: both children take cell `1 / 1` and the later one paints on top. Position the pill and the overlay resolves against the pill instead, which is the whole of the trick. A pseudo-element's hit area belongs to the element that owns it, so hovering anywhere on the card lights the pill too, and the card keeps exactly one link with one accessible name — which a second anchor around the cover would not. It also settles who owns a click on the artwork: `ImagePreviewClient` treats an unlinked `<img>` as a lightbox target, so before this, clicking a poster opened a picture of it instead of the film.

**What the row still needs to look like the mock everywhere:** a плакат on the three films that have none. `contain` rather than `cover` is deliberate — cropping cuts the film's title off the artwork — so a card that falls back to a 16∶9 still shows it in a band. The band is **dark** (`--gray-9`), not white: every poster the mock draws is dark artwork edge to edge and the pill over it is white, so a white band made the pill vanish into the card. A плакат covers the box, so the colour is only ever seen on the fallback.

The cover also carries `loading="lazy"` — written into the block, because WordPress does not add it here and a printable плакат is ~800 KB. The row is the last thing on the page; six of them eagerly is a megabyte-scale download for content nobody has scrolled to.

**Repo-wide fix that came out of it: every carousel arrow on the site was an empty circle.** `custom-carousel.css` drew the chevron with `background: url('../../assets/icons/chevron-right.svg')`, and svgr is registered for **every** `.svg` in `next.config.ts` — so the file compiled to a JS module and the background resolved to a script, with no 404 to notice. The chevron is now an inline `data:` URI. Arrows also kept rendering when a carousel had `navigation: false`; they are hidden now.

**Three more, from reviewing `CarouselAdapter` itself** — all of them affecting every Gutenberg carousel on the site, not just this page:

- **A carousel inside a news article was mounted twice.** The adapter scans the whole document, and `NewsArticle` renders two `GutenbergProvider`s — one for the lifted header, one for the body — so each brought an adapter and both mounted every `.swiper` they found. Swiper does not guard against it: its constructor stamps `el.swiper` and overwrites whatever was there. The adapter now skips an element that already carries the stamp.
- **Nothing was ever destroyed.** Every instance kept its resize and pointer listeners after the route changed. The effect now returns a teardown.
- **The arrows and bullets were unreachable by keyboard**, because the plugin renders them as bare `<div>`s. Swiper's `A11y` module supplies the roles, the tab stops and the live region; its own copy is English, so every string it announces is replaced with the Russian one. (`shared/ui/components/Carousel` — the React carousel — already did this; the Gutenberg one had been left out.) `CarouselAdapter.test.tsx` pins all three.

**One thing the page still needs from WP.** The methodology cover is a **210×300 upload** blown up to 386 wide, so it is visibly soft — a better file, not a CSS change. A first pass also borrowed a film's printable плакат automatically whenever its cover was landscape; it was fifty lines of WordPress lookup for one image and came back out.

`php wp/tests/od-pages.test.php` covers the transform against the real captured `post_content` in `wp/tests/fixtures/` — structure, prose, preserved ids, what is dropped, idempotency, and that unrecognised input is refused rather than half-converted. Applied to od-dev and checked in a browser at 1440 and 375, with the layout measured out of the DOM against the Figma frame's own bounding boxes.

**Five traps this hit**, all now in the flow doc. Two are about getting the change to run at all: `wp eval-file` runs in a function scope so `$wpdb` needs a `global`, and the dev server serves the old copy until the page's cache tag is purged. Three are CSS, and all three come from core's block stylesheet being imported *after* `gutenberg.css`, where **a tie loses**:

- A single-class rule of ours ties with core's and loses — `.wp-block-image.od-programme-logo` needs both classes.
- Core sizes every column with `.wp-block-columns:not(.is-not-stacked-on-mobile) > .wp-block-column`, which is **four classes**; `.od-card--flush > .wp-block-column:first-child` is four as well, so it silently did nothing and the card split 50/50. Prefixing the modifier with `.wp-block-columns` buys the fifth.
- **Turbopack does not track `@nested-import` dependencies.** `gutenberg-provider.css` pulls this file in, so editing `gutenberg.css` alone leaves the dev server serving the previous CSS chunk indefinitely — the page renders with *none* of the new rules and looks like the design was never written. Touching the file does not help (the graph is content-hashed); editing `gutenberg-provider.css` itself does. Check with `curl` on the `<link>` the page emits before believing a rule is broken.

### D6f. `/healthy-kids/` and `/healthy-youth/` on the same template — 2026-08-18

The other two programme pages, against Figma **`project-3`** (`759:1117`) and **`project-2`** (`759:1379`). Both mocks turned out to be these pages and not the speculative "project detail templates" the plan had them down as — `project-2`'s breadcrumb reads «Программы → Здоровая Молодежь», `project-3`'s «Здоровые Дети», and each carries its page's own goal sentence verbatim. That closes the open question in the plan about whether `project-1/2/3` correspond to anything real: all three are the programme pages, and there is no fourth template.

Two transforms in `wp/scripts/od-pages.php` (`od_pages_healthy_youth()`, `od_pages_healthy_kids()`) and no new mechanism. WP posts **60392** and **60449**; the migrator reports both already in its canonical shape, so the captured fixtures are exactly what production will produce.

**Three things the two mocks do that `project-1` does not**, and where each went:

- **The task cards are numbered, not titled.** `project-1` gives each card an `<h3>`; these give it «01», «02», … in the same 32px red above the same 24px of space. It was built as a CSS counter on `.od-cards--numbered` and taken back out on review: a number an editor can see and retype beats a rule they have to be told about, and a value that exists only in a stylesheet is invisible in the editor, in a content export and in a grep. It is a `core/paragraph` classed `od-task-number`, reusing the `h3` rule outright since the mock draws them identically.
- **Two tasks, so two cards.** `/healthy-youth/` has two, and the mock widens them to 600px rather than leaving the third slot empty. `od_pages_carousel()` took a fourth argument for it, and `od_pages_numbered_tasks()` passes the slide count — the row is still a carousel, so a third task added in the admin re-splits it at 387 with no edit here.
- **The approval note stands alone.** On `/healthy-russia/` «Программа прошла экспертизу…» is the methodology card's body; neither of these pages has such a card, and both mocks set the sentence as a 24px bold paragraph across the column — `.od-note`, 65px under the task row rather than the usual 120 (`:has(+ .od-note)` on the row, because the gap belongs to the block above or it collapses and loses).

Everything else is the `project-1` template unchanged: the logo card, the goal card with its CSS-background drawing, the 120px block rhythm, the 45px heading gap, and «Проекты программы» as a `core/query` over the programme's tag. **Both pages have that row**, though only `project-2` draws one — `project-3` was drawn before the «Команда Познавалова» cartoons were identified as «Здоровые дети»'s lessons, and the row is the same query block either way. Two new tags, `programma-zdorovaya-molodezh` (seven films) and `programma-zdorovye-deti` (two), in `wp/scripts/od-wp.php`.

The registry itself now maps a path to **a transform and the tag its film row queries**, and the runner resolves that tag per page instead of one at the top — an empty slug means the page has no row, and a missing tag warns for that page rather than aborting the run.

**Content the mocks have nowhere to put, kept anyway.** Both pages ended in `<h3>`s that were links — «Методические рекомендации» and «Фильмы программы» on one, «Методические материалы» on the other — and `/healthy-youth/` also carried a booklet cover above a «Скачать методичку PDF» button. Neither mock has a slot for any of it. Dropping a live download because a mock omits it is a worse outcome than a small deviation, so the links hang **under the goal paragraph, inside the goal card** (`.od-card-link`, body size against the card's 24px) — the one place on the page where a link about the programme reads as being about the programme. The two decorative images do not survive. On `/healthy-youth/` the trailing heading pointed at the same Yandex Disk file as the button, so one link covers both.

**One link was pointing at the site this one replaces.** «Методические рекомендации» was written as `https://общее-дело.рф/materials/pppuiv-ted-6/` — an absolute URL to the live domain, which `resolveContentLinks` leaves alone because it only rewrites the WordPress origin. `od_pages_site_link()` strips the origin from the bare, `www.` and Punycode forms of the two site domains, and only those: `metodic.obshee-delo.ru` is a different site and keeps its own.

**`od-terms.php` became `od-wp.php`.** Its name said taxonomy while most of what it does is not — it tags a film, names the film's cover and fills the film's плакат — and the split that matters between the two scripts is not *which page* a change serves but *what it is made of*: `post_content` in `od-pages.php`, WordPress objects here. It is one task today, `od_wp_tag_programme_films()`, called from the runner; a second is another function and another registry, with no framework in between until there is a third. That registry is one entry per programme, mapping **film slug => плакат upload path** — an empty path meaning «leave it alone», which is what a film that already has one gets. Paths are root-relative and `home_url()` puts the origin back at write time, since the origin differs per environment; the ACF field key goes in beside the value, or the admin renders the field empty and clears it on the next save. Fixed in the same pass: `alt_from_title` stored the post title raw, and several film titles hold their guillemets as `&#171;`/`&#187;` — an alt attribute is escaped on the way out, so the entity would have been escaped a second time and read aloud as its own text.

**Four films got the плакат the row was missing.** Before this, one of `/healthy-youth/`'s six had one (`43846`) and the rest letterboxed their 16∶9 still. The artwork the mock draws was already in the media library — it is what the page itself carried before it was rebuilt — and four of those files are portrait at 366×517, so `od-wp.php` now sets them: `plakats_2office_man.jpg`, `plakats_2office_woman.jpg`, `how-to-love.jpg`, `dirty-words.jpg`. **`way-of-hero.jpg` is 420×359 and is deliberately left unset**: a landscape file letterboxes in a 3∶4 card exactly as the still does, so it would buy nothing. Setting the field also gives those films a плакат card on `/<id>`, which is the same claim made in the same place. `/healthy-kids/`'s «Опасное погружение» already had one; «Тайна едкого дыма» falls back to its YouTube still.

**Which films are which lesson** was settled from the programmes' own lesson lists. «Здоровая молодежь» is seven lessons and **all seven have a film**; three are titled differently from the lesson they belong to, which is why matching by name found only four — «Тайна природы женщины» is «Девушка в современном социуме», «Как научиться любить?» is «Уровни развития отношений», and «Докажи, что любишь» (`66423`) is «Опасность ВИЧ и других ЗППП». «Здоровые дети» is the «Команда Познавалова» cartoons; two are named on the page and a third, «Задача по зубам» (`70847`), is in the catalogue and may be a later lesson. Adding it is a slug in the registry.

**Deviations carried over from D6e**, unchanged: the red `<h1>` the mocks replace with the logo card, and the poster pill carrying the film's title rather than «Подробнее». The row's date-descending order was raised with Design and **accepted** — no `menu_order` needed.

**One trap cost a review round.** The numbering did not render on the dev server while every measurement said it should: `getComputedStyle` reported the right size and colour and a screenshot showed «01», because the CSS *was* served when the page was measured. The `stylelint --fix` that lint-staged runs on commit then rewrote `gutenberg.css`, and Turbopack does not track `@nested-import` dependencies — so the chunk went back to the version from before the change and stayed there. **A commit can make a fresh chunk stale.** `gutenberg-provider.css` says so now.

`php wp/tests/od-pages.test.php` covers both transforms against real captured `post_content`, and `php wp/tests/od-wp.test.php` checks the registry for the typo it can actually have — a film listed twice under one tag, or a плакат written as an absolute URL. Applied to od-dev and measured out of the DOM at 1440 and 375 against the frames' own bounding boxes: goal card 1240×404 (mock 402.83), tasks 387×240 ×3 and 600×189 ×2 (mock 387×239, 600×189), gaps 120 / 44 / 65 / 119 / 45, posters 387×546 at 40 apart, and two Swipers on the page with two mounted — no double init.

### D6g. `/projects/` moved off the route and into WordPress — 2026-08-18

The index shipped in D6 as `app/projects/page.tsx` over `shared/config/programSections.ts`. It looked right and could not be edited: adding a card, renaming one or repointing a link took a deploy, on a page whose entire content is a list of six links. WordPress has had a page at that URL all along (**#59466**, «Программы и проекты»), which the native route shadowed. So the route was deleted and the page rebuilt in `post_content` by `od_pages_projects()` — the same flow the programme pages use, and the reason the flow exists.

Deleting the route is the whole switch: App Router precedence works in both directions, so removing `app/projects/` hands `/projects/` back to `[...slug]`, which finds a published WP page there and renders it through `WpPage`. No redirect, no config entry, no change to `legacyEmbedPages.ts`.

**The card is a column.** Each row is a `core/columns` classed `od-tiles`, and each card is one `core/column` classed `od-tile od-tile--<id>` holding an `<h3>` and a «Подробнее» paragraph. That is what the old page did too (`.program-box`), and it means adding a seventh card is adding a column in the editor. `gutenberg.css` makes the row a grid rather than the columns block's flex — three equal tracks to `--mobile`, then one — so a card added or removed re-flows without an inline `flex-basis` to fight.

**The drawings stayed in the repo, as backgrounds.** They are Figma exports, not editorial images, and `.od-card--goal` had already set the precedent: a decoration in `post_content` is a thing an editor can delete by accident, and there is nothing to gain by it. Each card id has a file at `public/figma/projects/<id>.svg` and one `background-image` line. A card added in the admin matches no rule and draws an empty box, which keeps the row aligned and says what is missing. They are **copies** of the six `src/shared/ui/assets/illustrations/*.svg` the home page imports — CSS cannot reference those, because `next.config.ts` routes every `*.svg` through `@svgr/webpack` as a JS module.

**The three directions were written into the page, not read out of it.** «Общее дело ПРО», «Видеоматериалы» and «Онлайн курсы» only ever existed in `programSections.ts`; the old WordPress page had the three programmes and nothing else. This is the one transform that reads nothing back out of its input — there is no attachment or post id in the old markup that survives the rewrite — so its fingerprint check is all the input is used for.

**Two lists now, and they can drift.** `programSections.ts` stays, because the home page's carousel still reads it, so the same six cards exist here and in `post_content`. A card added in the admin appears on `/projects/` only, and one added to the config appears on the home page only. That is the cost of the page being editable without a deploy, and it is written at the top of the config file; the alternative — the home page parsing another page's blocks for its carousel — is worse. `PROJECTS_TITLE` was the one export only the deleted route used and is gone.

**What changed for a reader.** The H1 is «ПРОГРАММЫ И ПРОЕКТЫ», the WordPress page's own title, where the route hardcoded the mock's «ПРОГРАММЫ» — the title is the editor's now, and the breadcrumbs row `WpPage` draws appears where the mock omits one. `NewsletterSignup` is gone from the page, since no WP page renders it. The cards themselves are unchanged: 387×361 at 1440 against the mock's 385×358, one per row at 375. The `/projects/` entry in `sitemap.ts` stays pinned at 0.8 rather than falling to the 0.7 the WP page enumeration would give it.

`CardSection` and `IllustratedCard` survive this — `/materials/` renders the same rows and the home page the same card. The wide 598×280 variant is still built and still used only by `/materials/`.

### D7. Video — index 2026-06-04, player 2026-07-02

Figma: index `video` (`706:3315`) + `video-filter` (`1554:17574`) + player `video-page` (`1566:10433`) + mobile `video-page-mob` (`1567:10735`, `1567:11844`) + download (`1581:10334`).

**Index 2026-06-04** — `app/video/page.tsx`, async RSC, `revalidate=3600`, dynamic. `fetchVideoList` reads `post.acf.*` + `categories` + featured image, paginated via `X-WP-Total{,Pages}`. `src/modules/Video/`: `VideoCard` (horizontal poster · body · share row — `Frame 33967`; renders each affordance **only when its field is non-empty**) and `VideoFilter` (client; desktop = C6 `Dropdown` «Подобрать фильм по теме», mobile = C5 `Tabs` — `Frame 33812/33813` — toggled by CSS). Composed with C3 `PageHeader` («Фильмы Общего дела»), C4 `Pagination`, `NewsletterSignup`. Added `RutubeIcon`.

**Player 2026-07-02** — then at `app/video/[id]/page.tsx`; **A8 later moved it to `modules/Video/FilmPage` rendered at `/<id>`**, so read paths in this section as historical. SSG seed 20 + `dynamicParams`, `revalidate=3600`, `generateMetadata` incl. OG poster, `notFound()` for missing/non-`format=video` ids — all survived the move. New `fetchVideo`/`cachedFetchVideo`; a shared `mapVideoSummary` was extracted from `fetchVideoList`. New pieces: `FilmPlayer` (16:9 hero — Kinescope iframe when `kinescope_id` is set → poster linking out to `watch_url` → bare poster → nothing), `FilmActions` (download pills + trailer + share tiles; strip disappears when all empty), `RelatedFilms`, plus `absolutizeWpMedia` (film bodies use root-relative `/wp-content` srcs) and a shared `sharePlatforms.ts`. Body renders through `resolveContentImages` + `parsePost`/`GutenbergProvider`. `next.config.ts` gained `staticGenerationRetryCount: 3` + `staticGenerationMaxConcurrency: 4` (od-dev 503s under the default parallel export).

**Figma fidelity pass 2026-07-02** — breadcrumbs-only header («Видео → title», no red H1; the film title is a PT Sans Bold 32/28 H1 in the content column); player + action strip merged into one white hero card (share tiles left, «Скачать фильм бесплатно» right with thin 28px pills, duration-only labels, pinned right even without the share group); two-column content (`minmax(0,1fr) 387px`) with `FilmPosterCard` — the printable плакат is **lifted out of the legacy post body** by `extractFilmPoster` (which also dedupes in-body anchors matching the structured download URLs; legacy 66/33 block columns flattened via CSS); body typography 22px/130% with `CollapsibleBody` («Развернуть»/«Свернуть», short bodies self-unclamp); `RelatedFilms` reworked to the mock card; `NewsletterSignup` removed (not in the mock). Verified in-browser at 1440/375 on **70570** («Деньги с дымком» — poster card + real Kinescope playback) and **71933**.

**Follow-up fixes 2026-07-03 (Alexey's review).** (1) **Share-platform icons are the official brand marks** (VK Видео / YouTube / Rutube), exported from Figma at 4× into `src/shared/ui/assets/images/platform-*.png` — they're raster image fills in Figma, no vectors exist. `sharePlatforms.ts` carries `logo`/`iconSize` instead of monochrome `Icon` components (which remain in `Icons/`; `vk.svg` stays white for the Footer, with a `vk-circle.svg` currentColor twin). (2) **`extractFilmPoster` generalised** — the poster image no longer requires a «плакат»-named file; the figure directly above the first download anchor also qualifies, with aspect ratio parsed from the `-WxH` suffix. (3) **All in-body «Скачать …» disk.yandex anchors are lifted into pills**, deduped against the ACF pair — 11 films carry 2–5 same-duration size/format variants the 2-slot ACF model couldn't hold.

**Catalogue scope narrowed 2026-08-03.** «Все» used to be every `format=video` post (203) — but that set is dominated by **«Видео события» (`52`, 115 posts)**, event reports rather than films. The tab is now the union of the four «Видео» 85 children (`581,580,86,559`) = **99 films**. The four category counts sum to 101 because two posts are double-filed. `fetchVideoList` takes `category: number | number[]` (OR-matched); `generateStaticParams` seeds SSG from the same set.

### `/materials/articles/` — thin alias route, 2026-08-13

Never a D8 build. `app/materials/articles/page.tsx` lists category **578** in full through the shared `modules/News/NewsGrid`.

Verified against WP before building: the live page is a hand-curated list of **14** links, every one a post in category 578, and the category holds **19** — so the listing is that page's superset and nothing curated is lost.

**A route, not a 301 to `/news/?category=articles`,** because **114 entry visits** in 91 days land on this URL from search — it is the address the collection is known by. It self-canonicalises; the index's «Статьи» chip canonicalises *onto* it, while `?category=articles&page=2` still self-canonicalises (a different slice, not a duplicate). `/category/articles/` was repointed here, and it is seeded into `sitemap.ts`. Its five child pages (`about-beer`, `need-to-know`, `main-factor`, `russia-power`, `what-is-going-on` — 12 views or fewer each) are real WP pages and stay on the A6 fallback.

Gate 12 moved 83.7 % → 84.2 %, exactly the 114 visits.

### `/materials/` — section index (D8), 2026-08-15

`app/materials/page.tsx`, from Figma `ads` (`778:2206`). Four white cards in a 2×2 grid (598×280, radius 12, padding 25): a 24/700 title top-left, a red «Подробнее» stretched over the whole card, and a ~200px illustration on the right. Static — no `revalidate`, no fetch, no props.

**The route owns no CSS**: that card is `IllustratedCard`'s `wide` variant and the 2×2 is what `CardSection` gives four cards (`toCardRows`: 2 + 2), both from D6. The page shipped with its own copy first — the two landed on the same day from different branches — and the copy was deleted on merge, along with its 86 lines of card CSS. Only two pixel choices changed with it: the column gap follows `CardSection`'s 40 rather than the mock's 44 (D6 already normalised the mock's gaps to 40), and on `--mobile` the card collapses to the portrait shape — drawing above the title — instead of staying a row, which is what `/projects/` does and neither mock draws.

**It is four hard-coded links, and that is the whole page.** The live index has carried the same four groups for years, and the CPT question ([`wp-backend.md` §8](./wp-backend.md#8-outstanding-questions-the-wp-state-doesnt-answer)) belongs to the sub-pages behind them, not here — inventing a taxonomy to render a fixed quartet would have put that decision on the critical path of the one D8 page that doesn't ask it. The hrefs are the live page's own: `/materials/metodichki/`, `/materials/printed-products/`, `/materials/articles/` (the shipped alias), `/materials/social-reklama/`. Three of the four still answer through the A6 fallback; `page.test.tsx` pins them, because this hub is the section's only navigation and a typo would be a dead end no other route catches.

Built ahead of its entry traffic on purpose: **107 entries against 939 views (8.8×)** in 91 days — nearly nobody lands here from search, but it is how the section gets browsed, so it is what an iframe would have been seen through. Seeded into `sitemap.ts`, and `/materials/articles/`'s «Материалы» breadcrumb is now a link.

**Repo-wide fix that came out of it: SVGO was stripping `viewBox` from every illustration.** `removeViewBox` (on in svgr's default preset) drops the attribute whenever it equals `width`/`height` — exactly a Figma export at natural size. Such a file cannot be scaled at all: CSS resizes the SVG viewport and the drawing stays 1:1 and is clipped. Invisible on the icons (their `width`/`height` are set smaller than the viewBox, so it was never removed) and invisible on home's `direction-*.svg` only because `Directions.module.css` sets `overflow: hidden`. `next.config.ts` now passes `svgoConfig` with `removeViewBox: false`; the home cards visibly gained the bottom of their illustrations.

**Second fix out of the same merge: wide cards broke titles mid-word around 1000px.** Two 598 cards become ~420 there, and `.wide .illustration`'s 55 % share left the body ~120px — narrower than «Методические» at 24/700, so the word wrapped inside itself. The body's `min-width` is now `min-content` (its longest word) instead of `0`, and the illustration `min-width: 0`, so the drawing yields first. No breakpoint involved, and desktop is unchanged.

Deferred: the newsletter block is *not* in the Figma frame — kept anyway, since the live page has one and every other index route ends with it.

---

## 4. Shipped — data & media (B, E)

### B-VIDEO. Film data model — 2026-06-04 (od-dev), re-shaped 2026-07-03

Installed **ACF free 6.8.3** and created a flat field group **`group_film_meta`** on `post_format == video` posts, everything `show_in_rest`. **Current shape (verified over REST 2026-08-13, group post id `72999`, 18 keys):** `kinescope_id`, `watch_url`, `trailer_url`, `download_{1..5}_url` + `download_{1..5}_label`, `share_vk`, `share_youtube`, `share_rutube`, `poster_image_url`, `poster_download_url` — all url/text, flat, no repeater, so ACF free suffices.

Set up **purely via WP-CLI** (no GUI, no mu-plugin) and **reproducible on any env** via `wp eval-file - --url=<site> < setup-film-acf.php`. Scripts and exact commands live in the ops repo: `servers-agent/tasks/2026-06-04-od-dev-film-acf-recon/`.

*Historical:* the 2026-06-04 original had 11 keys with a fixed `download_full_*`/`download_short_*` pair; `migrate-download-slots.php` folded those into slots 1/2 and deleted the old meta. The **2026-07-03 rework** replaced that pair with 5 generic slots (`download_{1..5}_{url,label}`, label = the full pill text) plus `poster_image_url` and `poster_download_url` — because films carry up to 5 same-duration size/format variants a 2-slot model couldn't hold. When promoting: re-run `setup-film-acf.php`, then `migrate-download-slots.php`.

**ACF is canonical; body-parsing is a fallback** (Alexey, 2026-07-03: «parsing is not stable»). Precedence on the film page: ACF first, body-parsed values fill only what data entry hasn't covered (downloads deduped by URL, ACF label wins). Extraction always runs so legacy in-body blocks stay out of the rendered body.

**Video taxonomy.** Parent category **85 «Видео»** (`video`), children: **Фильмы `581`** (`movies`, 23) · **Мультфильмы `580`** (`mult`, 8) · **Ролики `86`** (`roliki`, 15) · **Известные люди `559`** (`famous`, 55). No distinct «короткометражки» category exists; the live-site "5th" is `Видео события` `52`/`actual` (115), a top-level sibling rather than a child of 85.

**Bonus discovery (recon).** od-dev already exposes public **`project` and `profile` CPTs** + plugins `contact-form-7`, `wysija-newsletters`, `leyka`, `wp-graphql` — see B-CPT in the plan.

### Data-entry tooling — 2026-08-03/05

`pnpm film:export` / `film:import` / `film:remap` / `film:kinescope` / `film:covers` (`scripts/`, zero-dep Node, `node --env-file=.env`). `film:export` writes a CSV worksheet of the 99 catalogue films with **every ACF column pre-filled from live WP** (`.scratch/film-worksheet.csv`, UTF-8 BOM so Excel reads Cyrillic; `--delimiter ';'` for RU-locale Excel, `--all` for all 203). `film:import` writes a filled sheet back over REST: **dry-run by default**, sends only changed fields, an **empty cell never clears** a value (use a literal `-` to clear), `--only <ids>` to scope, `--apply` to commit. Export→import round-trips to zero diff.

Body-mined candidates land in advisory **`hint_*` columns only** and are never auto-written into ACF columns — parsing stays a human-reviewed suggestion.

⚠️ **`scripts/lib/wp.mjs` keeps its own copy of the film category ids** (zero-dep Node can't import TypeScript), and it runs in runbook §3 — *before* the §4.3 id fix-up. A wrong id there makes `film:export` write an empty worksheet, which reads as "no films need data" rather than an error.

### Telegram channel as a link source — harvested 2026-08-03

The public channel **«ФИЛЬМЫ | ОБЩЕЕ ДЕЛО»** (Telegram Desktop export → `result.json`) has one post per film carrying the title, a Dzen trailer, VK Видео / Rutube / YouTube watch links and 2–5 Яндекс.Диск downloads with durations — everything in the ACF model except `kinescope_id`, which appears nowhere. 38 film posts → **28 matched to WP rows** (title match, cross-checked against Яндекс.Диск file ids shared with the post body; 20 corroborated, none contradicted), yielding **154 empty cells filled across 27 films**: `share_vk` 27, `share_rutube` 27, `share_youtube` 25, `poster_download_url` 15, `trailer_url` 12, `poster_image_url` 10, 19 download slots. Zero conflicts with existing WP values. Posters come from the **WP body**, not from Telegram's attached JPEGs.

**Two findings for editors:** **8 films are on Telegram but have no WP post at all** — «Правда и ложь про сухой закон», «День рождения», «Как найти призвание», «Алкоголь. Взгляд изнутри», «Большая опасность маленьких размеров», «Папуасы», «Три секрета, как раскрыть призвание», «Сахар атакует». And **67400 «Курение. Взгляд изнутри» has a mislabelled ACF download** — `disk.yandex.ru/i/-5L5AfVOrXQFlw` is stored as «Сокр. версия» but is the 35-минутная полная версия.

*Baseline at the **start** of data entry, 2026-08-03 — superseded by the B-VIDEO2 table in the plan, kept only for comparison:* `kinescope_id` **1**, `watch_url` **0**, `trailer_url` **0**, `share_*` **1**, poster fields **1**, `download_N_url` **22**, featured image **6**. Bodies then offered: **86** films with `disk.yandex` links, only **7** with a real YouTube link, **0** with Rutube.

### B5. Custom WP plugins — identified

`wp-block-cb-carousel-v2` comes from the **carousel-block** plugin (Codeboxr, v2.0.5). Full inventory in [`wp-backend.md` §4](./wp-backend.md).

### B2. Type generation unblocked — 2026-08-13

`redocly.yml`'s `x-openapi-ts.output` carried a stray space (`./src/types/generated /wp-json-openapi.ts`), so `pnpm generate:types` had been writing a **directory** named `generated ` and the committed types had been frozen since 29 May. Path fixed; regenerated against od-dev.

Two things to know before running it again. **Pipe the result through Prettier** — openapi-typescript emits double quotes and 4-space indent, which isn't this repo's format, and without that step the diff is 35 000 lines of quote churn instead of the 434 that changed. And **read the diff**: ten weeks of od-dev drift amounted to ACF adding an `acf-disabled` post status to every status enum plus an `_acf_changed` write-payload flag, and `meta` going from `Record<string, never>` to `{}`. **No paths added or removed** — `/wp/v2/{posts,pages,categories,profile,project,search}` and CF7's `feedback` endpoint were all already in the schema, which is why nothing downstream broke.

### B3. Cache tags on every WordPress request — 2026-08-13

`src/shared/api/cacheTags.ts` — `WP_TAGS`, `postTag(id)`, `isWpTag()` and `wpCache(tags, revalidate?)`, which returns the `next: { revalidate, tags }` fragment that both `wpFetch` and the typed client accept. All eleven runtime WP call sites go through it.

**Tags are what make a *page* purgeable, not just its JSON.** Next records the tags of every fetch a render touched onto that route's ISR entry, so `wp:post:123` drops the prerendered `/123/` along with the response it was built from. Without them B4 would have had nothing to address.

Granularity is deliberately coarse: WordPress keeps news, articles, films and event reports in the single `post` type, so any post edit purges `wp:posts` and every listing with it — cheaper than teaching a webhook which of ~8 200 posts appears in which listing, and wrong only in regenerating a few pages that hadn't changed. `wp:films`, `wp:menus` and `wp:widgets` keep the catalogue, header and footer out of that blast radius.

Two side effects worth noting. The **header and footer were previously uncached** and render in the root layout, so every dynamic request hit WordPress for the nav; they now cost one request an hour. And `generateStaticParams` is deliberately left **untagged** — it picks the ISR seed once per build and returns a list of ids, so there's nothing to purge and a cache window there could only serve a rebuild a stale seed.

The fragile part is pinned by a test (`httpClient.test.ts`): the typed client's cache options survive only because openapi-fetch copies leftover init keys onto the `Request` it builds (`new Request()` drops unknown keys) and Next reads `next` off a Request input as well as off `init`. If an upgrade changes either, fetches silently go untagged — no error anywhere.

**One part of B3 as written was not done: "every fetcher typed via openapi-fetch".** The five listing/detail fetchers still use raw `wpFetch`, for two reasons that converting them wouldn't fix. The generated schema's `post` type describes neither `_embed`'s `_embedded` nor ACF's `acf` — the two things those fetchers exist to read — so the typed client would hand back a type that omits most of the payload. And the client's throwing middleware turns a non-2xx into an exception, while these fetchers depend on an out-of-range page (400) and a missing post (404) being *answers*: «no results» and `notFound()`. `fetchSearch` shows the middle path that is worth copying — raw `wpFetch` for transport, with the payload typed off `components['schemas']['search-result']` from the generated file, so the shape is still schema-derived. Revisit only if the WP-side OpenAPI plugin starts describing `_embedded` and `acf`.

### B4. On-demand revalidation — the frontend half, 2026-08-13

`POST /api/revalidate/` (`src/app/api/revalidate/route.ts`), secret-gated by `REVALIDATE_SECRET` in an `x-revalidate-secret` header. Body is `{postId}`, `{postIds}`, `{tags}` or `{paths}`; answers 200 with what it purged, 401 on a bad secret, **503 when no secret is configured** so a half-configured tier is inert rather than open, 400 for everything else.

Verified against a production build rather than mocks:

| | |
| --- | --- |
| `{"postId":71933}` | `/71933/` HIT→MISS, **and** `/materials/articles/` HIT→MISS — a different fetch sharing `wp:posts` |
| `{"tags":["wp:films"]}` | `/71933/` (film) HIT→MISS, `/72897/` (news) stays **HIT** — the tags discriminate |

Four decisions behind the code:

- **`revalidateTag(tag, { expire: 0 })`, not a named profile.** Every built-in profile including `'max'` only marks the entry *stale*, which serves the pre-edit page once more while it rebuilds — precisely the "I published it, where is it?" this route exists to remove. The one-argument form does expire immediately but is deprecated in Next 16, and `updateTag` is Server-Actions-only and throws in a route handler.
- **Only `wp*` tags are accepted.** Next's implicit route tags (`_N_T_/…`) are addressable through the same API, so taking arbitrary tags would turn a leaked secret into a purge of the entire render cache.
- **Secret in a header, never `?secret=`** — a query string lands in every access log and proxy trace between WordPress and the app. Compared over SHA-256 digests so `timingSafeEqual` gets equal-length inputs and can't leak the secret's length.
- **Both slash variants of a `paths` entry are purged**, because `revalidatePath` addresses a route by an implicit tag derived from the pathname it rendered at, and `trailingSlash: true` makes it unknowable from outside whether that was `/news` or `/news/`.

The endpoint must be posted **with** its trailing slash — the slashless form is a 308, verified, same trap as `/health/`. `postIds` was added when the WordPress half landed: one WP request can change many posts (a bulk trash fires the hook per post), and the caps are read off the *inputs* rather than the tag set they expand into, since 50 ids legitimately expand to 51 tags.

### B4. On-demand revalidation — the WordPress half, 2026-08-13

An mu-plugin, source in this repo at [`wp/mu-plugins/od-revalidate.php`](../wp/mu-plugins/od-revalidate.php), **installed on od-dev** and deliberately inert there: `OD_REVALIDATE_URL` is commented out because od-dev has no frontend deployment to purge. Procedure, install commands and the WP-side detail are in [`wp-backend.md` §6.5](./wp-backend.md). What is worth knowing here is what the testing changed about the design.

**«Non-blocking» in the WordPress HTTP API is not fire-and-forget.** The curl transport calls `curl_exec()` for a non-blocking request too and merely discards the response, so the caller still pays the connect-and-timeout cost. Measured over five identical REST title edits on od-dev: a save against an unreachable frontend took a **median 8216 ms against a 2607 ms baseline** — `blocking => false` bought nothing, and the first draft of §6.5 had promised on that basis that «an editor never waits». Now the plugin blocks on purpose (the response is the only way to know a purge landed) and protects the editor with `fastcgi_finish_request()` plus a 5-minute breaker transient after a failure: 6630 ms once, then 795–1765 ms. **od-dev is `apache2handler`, not php-fpm**, so that function doesn't exist there and the breaker is the whole protection.

**It sends one request per WP request, not per hook.** Everything is queued and flushed on `shutdown`: a bulk trash of three posts is one POST carrying three ids, and trashing a published post — which fires both `wp_after_insert_post` and `trashed_post` — is one. The shutdown flush also settles the ACF question for free: every write in the request is committed before the frontend is told anything, so it cannot refetch ahead of the data.

**Draft churn is not published content.** A post that was never public (draft → draft, or a draft moving in and out of the bin) is skipped, so editors working in drafts don't repeatedly evict `wp:posts` — which is the tag every listing and the home feed hang off. Proven: a nine-step lifecycle produced seven purges, and a draft-only lifecycle produced one (the permanent delete, where no hook can know what the status used to be).

**How it was tested without a deployment.** No frontend is deployed and the shared host has no Node, so the two halves were joined by hand: a listener on od-dev's loopback recorded exactly what the plugin sends for every transition (secret compared by SHA-256 digest, never printed), and those bodies were replayed against the real route on a production build — `{"postIds":[72897]}` took the post *and* `/materials/articles/` from HIT to MISS, `{"tags":["wp:films"]}` took the film page and left both news pages HIT. The one hop nobody has exercised is WP → a deployed frontend over a network. Captures kept in [`servers-agent/tasks/2026-08-13-od-revalidate-mu-plugin/`](../../servers-agent/tasks/2026-08-13-od-revalidate-mu-plugin/README.md).

**Also settled:** outbound HTTP from WP works (200 in 0.26 s to an external host, from both CLI and web requests), which was an open question in `wp-backend.md` §8 and the last thing that could have made this impossible. ⚠ Measured on Timeweb — which, as of 2026-08-15, is **not** where live prod runs (BeGet, `ssh od-root`); re-check there before relying on it for the prod mu-plugin.

### B7. Search — the data layer, 2026-08-13

`fetchSearch` over `GET /wp/v2/search`, the endpoint B7 had already settled on. **Fetcher only** — the input belongs to `header-v2` (C9) and the results page has no mock, so neither was guessed at.

Probed against od-dev first, and the assumptions held: the endpoint sends `X-WP-Total{,Pages}`, honours `subtype=`, and answers an out-of-range page with `200 []` rather than the 400 `/wp/v2/posts` returns. It carries id/title/url/type/subtype and **nothing else** — no excerpt, no thumbnail — so a results UI that wants either has to fetch the posts separately.

Two behaviours that aren't obvious from the endpoint. **Posts are linked as `/<id>/`, not by the `url` WP reports**: WP hands back its own permalink on the `WP_BASE` origin, and passing that through would walk visitors off the site into the WordPress install; pages keep their path, which is where A6 will serve them. And **an empty query never reaches WordPress** — `?search=` isn't an error there, it matches everything, so WP would answer with the first page of the whole archive dressed up as search results. `subtype` is a parameter rather than a baked-in filter: what search should cover is a product decision.

### B-CPT. `profile` / `project` recon — 2026-08-13

Read-only pass over od-dev's two cmsms CPTs, to size D3 before building it. Full inventory in [`wp-backend.md` §3.5](./wp-backend.md); the load-bearing results:

- **`/profile/[slug]` is a template over existing data, not a content project.** 139 published records, 136 with a featured image, bodies already clean Gutenberg (median 902 chars).
- **The region field already exists in REST** — `meta.cmsms_profile_subtitle`, filled on 130 of 139. No ACF work, no body parsing. But it is free text: 89 distinct values, only 18 naming an oblast/republic, the rest bare settlements («Екатеринбург», «г. Якутск»). Displayable, not groupable without normalisation.
- **…and B8 would silently delete it.** The values are ordinary postmeta and survive plugin removal, but their REST exposure comes from cmsms's `register_post_meta`. The headless theme must re-register the key, and the cleanup's `DELETE … meta_key LIKE 'cmsms_%'` must exclude it. Both are now explicit steps in `wp-backend.md` §4.4.
- **The cmsms taxonomies aren't in REST at all** — `/wp/v2/pl-categs` and `/wp/v2/pj-categs` both 404, and `/wp/v2/types/profile` lists only `post_tag`, which 2 records use. There is no coordinator-by-region filter available unless re-registration adds `show_in_rest`. §6.2 had previously listed `pl-categs` as available; corrected.
- **Cyrillic slugs look like a trap and aren't.** 67 of 139 are percent-encoded, up to 194 characters; WP's `?slug=` matches the stored, decoded, re-encoded and case-flipped forms alike, so the route can pass its param straight through.
- **Contact details are prose**: phone on 92/139, email on 113/139, in mixed formats. That — not "region" — is what the "promote to ACF?" question is actually about.
- **`project` re-verified dead**: 0 published, no REST taxonomies, nothing links to it. D6 «Программы» stays plain WP pages.

### E3. File downloads — no build needed

On od-dev the "Скачать фильм" buttons are **Gutenberg button blocks authored in the post body**, linking out to Yandex.Disk. Not a separate file-serving flow — they ride along in the post HTML we already render via `parsePost` + `GutenbergProvider`. Only watch-out: rendered content's external links/buttons must display correctly (Gutenberg button-block CSS) and open sensibly (`target`/`rel`).

### E4. Video player — Kinescope, approved 2026-06-08, shipped 2026-07-02

**Embed [Kinescope](https://kinescope.ru/) as the on-site player + keep VK Видео / Rutube as external mirror links.** The [НКО tier](https://kinescope.ru/nko) is **approved for «Общее дело»** — RU+global CDN, transcoding, clean unbranded player, embed-by-ID.

Content is long-form documentaries (30–50 min), so an adaptive ladder is required — but we do **not** self-transcode or self-host. The hard part of E4 was transcode → ABR → storage → **delivery inside Russia**, not the player widget; Kinescope handles all of it and we keep only a video reference in WP.

**Alternatives, kept for reference:**
- **YouTube embed — ruled out.** Fully DNS-blocked in Russia since 10 Feb 2026 (not just throttled). Keep YouTube only as an external share link for VPN/diaspora viewers.
- **VK Видео / Rutube embed — viable free fallback.** RU-optimised, zero ops; iframe via «Поделиться → Экспортировать». Downside: their player chrome + branding/ads. The immediate fallback if Kinescope ever goes away.
- **Self-host (Yandex Object Storage + HLS + Vidstack/hls.js) — not recommended.** Means owning the transcode pipeline, paying storage + egress (~400–600 GB store + ~1 GB/720p-view egress → ~1 TB/mo at modest traffic), **and** building a custom presigned-upload flow (multi-GB files must not go through the WP media library). Only justified if full ownership is a hard requirement.

**Editor flow:** upload the master to the **Kinescope dashboard** → copy the video ID → paste into the film post's ACF field → the page renders the embed. **No large file touches WP.**

**Frontend:** `FilmPlayer` renders the responsive 16:9 `https://kinescope.io/embed/<id>` iframe (allow list per Kinescope's official embed code incl. `screen-wake-lock`; unsandboxed like YouTube/VK embeds — see the code comment), falling back to the poster linking out to `watch_url`, then the bare poster. Download pills below are always available. No heavy client player.

**Population turned out to be a matching problem, not a data-entry one** — the masters were already uploaded (the Kinescope library holds 261 videos). `pnpm film:kinescope` resolves ids via the YouTube bridge: **70 of 99 catalogue films as of 2026-08-05**, unchanged on 2026-08-13. The remaining 29 are B-VIDEO2.

### E1/E2. Media pipeline — partially shipped

WP media is **already offloaded to a Yandex object-storage bucket**; that decision is effectively made. The CDN host is allowlisted in `next.config.ts` `images.remotePatterns` via `src/shared/api/mediaCdn.ts` (`WP_MEDIA_CDN`, defaulted so it's always present; disable with `WP_MEDIA_CDN=""`), and `resolveMediaUrl` (`src/shared/api/mediaUrl.ts`) maps each WP-origin URL → its CDN copy with a `HEAD`-probe (1h cache) that treats only a direct 200 as present — the bucket **301-redirects missing keys instead of 404ing** — falling back to the WP origin for not-yet-offloaded media.

`next/image` is wired through `resolveMediaUrl`; `remotePatterns` covers the WP origin, the Punycode legacy domain and the media CDN; `minimumCacheTTL: 86400`. WP's *sized* variants return 500, so we deliberately request full-size only (`toFullSizeImageUrl`) and let Next re-optimise.

### WP titles are HTML — decoded once, at the fetcher boundary, 2026-08-17

`title.rendered` is markup, and this site prints titles as **text** everywhere: cards, the article `<h1>`, breadcrumbs, `<title>`, `alt` and `aria-label`. So a title WordPress renders as `&#171;Общее Дело&#187;` reached the page literally — visible on every news card, the `/video` catalogue, the film page and the news article, and guillemets — which WP renders as `&#171;`/`&#187;` — are in **1 114 of the 8 241 published post titles**, «Общее Дело» itself among them.

The fix is one call, `stripHtml` (`shared/api/newsPreview.ts` — tags to a space, then `decodeEntities`), applied where the WP shape is mapped to ours rather than where it is displayed: `fetchLatestNews`, `fetchNewsList`, `fetchFilms`, `mapVideoSummary` (so `fetchVideoList` *and* `fetchVideo`), `toNavItems` for menu labels, and `NewsArticle`'s two direct reads of the raw post. `fetchWpPage` already did this, which is why native WP pages were the one surface that came out right. `SimilarNews` was correct by accident — it ran the title through `html-react-parser`, which decodes — and now uses `stripHtml` like everything else, so `title.rendered` has no remaining raw reader.

The boundary is the fetcher on purpose: a title has one plain-text form and many display sites, and the alternative is remembering to decode at each of them.

---

## 5. Shipped — quality (F)

### F1. Testing — partial

**Vitest 4 + RTL 16 + jsdom** via `vitest.config.ts` / `vitest.setup.ts` with `vite-plugin-svgr` + native Vite tsconfig-paths; `pnpm test` / `test:watch` / `test:coverage`. **48 spec files / 233 cases** as of 2026-08-13, covering the shared primitives, every home section, the news + video + search fetchers, the cache-tag and revalidate layer, the routing config and the pure utils. Convention: `*.test.ts(x)` colocated, explicit `vitest` imports, wrap Radix-flavoured components in `<Theme>`.

Rationale worth keeping: AI-first development thrives on fast feedback — cheap unit/component tests catch regressions when an agent edits many files in one pass, far better than manual review of each diff.

**CI gate is done** (A3). **Playwright is wired but thin:** `playwright.config.ts` + `pnpm test:e2e` exist with a single `e2e/home.spec.ts`; it is **not** in CI.

### F4. SEO — the URL-facing half, 2026-08-13 (`ea290ac`)

It shipped with A8 because a URL layer nothing advertises is only half a migration — and because the live site's `sitemap.xml` comes from a WP plugin that stops answering the moment the frontend takes the domain, removing the discovery path for the whole archive at exactly the moment the URL set changes.

- **`app/sitemap.ts`** — **8 248 URLs**, every post at `/<id>/` plus the indexes, `revalidate = 86400`. Crawls `/wp/v2/posts` 100 at a time with `orderby=id` (WP's default `date desc` would let a post published mid-crawl shift the pagination window, silently duplicating and skipping ids), 4-way concurrent to match `staticGenerationMaxConcurrency`, 3 attempts per page. Under **90 % coverage it throws rather than publishing** — under ISR a throw leaves the previous body in place, whereas a truncated sitemap actively tells crawlers the missing URLs are gone. Handles the credential-free CI stub (no `X-WP-TotalPages` → publish the static URLs only) so a secretless build doesn't look like an outage.
- **`app/robots.ts`** — allow all, minus `/health/` and the not-yet-built search URLs.
- **`metadataBase` + `alternates.canonical` on every route**, from `src/shared/config/site.ts` (`SITE_URL`, defaulting to `https://obshee-delo.ru`; `canonicalUrl` always trailing-slashed, `fileUrl` never — `/sitemap.xml` must not be). Every canonical is **absolute, slash-terminated and self-referential**, including `?page=2`: collapsing paginated views onto page 1 would drop older posts out of the index for any crawler that doesn't read the sitemap. `/news` and `/video` (and each `/video/<segment>/`) carry per-page Russian titles + OG, so no two index pages share metadata.

⚠️ **`SITE_URL` fails silently when unset** — it defaults to prod, so a stage tier that doesn't set it advertises **prod's** canonicals and sitemap. Visible only through a crawler. Runbook §4.1.

### F6. 152-FZ compliance — the privacy page and the legacy consent, 2026-08-13

The plan called for porting the live privacy text into a new route with the Google Analytics reference stripped. That framing was wrong in a useful way: **the text belongs on prod, not in this repo.** `/conf_politics/` is Tier 4 — it stays on the A6 fallback indefinitely, and the fallback serves prod's content, so prod's page *is* the deliverable. Editing it there fixes the live site today and the new site at cutover, in one write. Prod page id **36316**; before/after content and the two option backups are in `/.scratch/f6-conf-politics/`.

**Already done by the owner, 2026-08-07/08** — found, not performed, during this pass: the GA tag and the VK retargeting pixel are gone from prod's HTML (each left a dated comment saying why — «передача данных за пределы РФ без необходимости»), §5.6 was rewritten to name Яндекс.Метрика only and assert that no data leaves the Russian Federation, and §§5.11/5.12/10.2/10.10/12.3 plus four cookie paragraphs were added. So the GA half of F6 was closed before this work started; what follows is the residue of that edit.

**Five defects fixed** — all mechanical, none of them a rewording of anyone's legal intent:

| | was | now |
|---|---|---|
| 1 | The cookie-retention sentence linked «целей обработки персональных данных» to **`https://nkopskov.ru/policy`** — a different NGO's policy, template residue on a registered СМИ's legal page | link removed, text kept |
| 2 | **§12.3 sat inside section 11**, before the «Трансграничная передача» heading — numbering ran `11.1, 11.2, 12.3, 12.1, 12.2` | re-seated after §12.2 |
| 3 | **§5.10.4 cited «п. 5.8.3»**, which does not exist — the block is numbered 5.10.x | «п. 5.10.3»; it was the document's only broken cross-reference |
| 4 | **§14.3** gave the policy's address as `https://общее-дело.рф/conf_politics/`, which 301s | `https://obshee-delo.ru/conf_politics/`, the canonical this repo advertises |
| 5 | Four cookie paragraphs dangled **unnumbered after §14.3** | **§15 «Файлы cookie»**, 15.1–15.4, in the document's own `<ol start="N">` style |

**§1.3 «Сведения об Операторе» added** — name, ОГРН 1127799010624, ИНН 7721490700, 109443 г. Москва, Волгоградский проспект д. 135 корп. 3, web@obshee-delo.ru. Roskomnadzor practice expects the operator to be identifiable from the policy itself; every value is already published on prod's own `/rekvizit/`.

**§2.3's domain list was deliberately left alone.** It omits `od-pro.ru`, which prod's own nav links to — but that host is a landing page; the contest data is collected at `reg.pro.obshee-delo.ru`, which the existing `*.obshee-delo.ru` wildcard already covers. Widening a legal scope statement to a site that collects nothing would be worse than leaving it. (Answers an open question, so it is not carried forward.)

**The cookie consent is now real, and it cost nothing to build.** §15.2 claims the Operator asks for consent; prod had no banner, which made the sentence false the moment it was published. **clearfy-pro — already active — ships a cookie notice, fully configured in Russian and simply never switched on** (`clearfy_option.message_cookie` was unset). Switching it on beats writing one: no new plugin on a WP 5.5.5 install, and it is discarded with the rest of the legacy theme at cutover. The banner text gained a link to `/conf_politics/`.

⚠️ **WP Rocket's "delay JavaScript execution" silently neutered it.** The notice's inline script was rewritten to `type="rocketlazyloadscript"`, so the banner stayed `translateY(150%)` off-screen until the visitor's first mousemove/scroll/touch — present in the DOM, invisible on load, and unclickable to anything that doesn't interact. Fixed by adding **`clearfy_cookie_hide`** (the cookie name, unique to that script) to `wp_rocket_settings.delay_js_exclusions`, which was empty. Verified with Playwright: banner visible before any interaction, «OK» removes it and sets a year-long `clearfy_cookie_hide=yes`. **Any inline script that must run on load needs this exclusion** — the trap applies to anything else added to the legacy site.

**Rollout is lazy, by design.** WP Rocket's lifespan is **10 hours**, so `/conf_politics/` was purged by hand and every other page picks the banner up as its cache expires. A full purge would have rebuilt 3 506 cached pages for no gain.

**The footer half needed verification, not building.** The СМИ registration line, ОГРН and **12+** live in od-dev widget `block-27` of `sidebar_bottom`, which C9's footer renders verbatim — so they are WordPress data and already present. Two hrefs in that widget do **not** survive the origin change, and both are recorded against F6 in the plan: the «Политика конфиденциальности» link is the absolute `https://od-dev.tmweb.ru/conf_politics/`, and the СМИ выписка PDF is a root-relative `/wp-content/uploads/…` — the file itself is on the media CDN, and only a WP origin 301s to it.

**Prod facts learned the hard way** (also folded into [`wp-backend.md`](./wp-backend.md)):

- **Prod's WP root is `~/public_html`**, not `~/obshee-delo.ru/` — that directory holds only a stub and verification files.
- **Prod runs WordPress 5.5.5**, pinned by the active `wp-downgrade` plugin, against 25 plugins including `wp-rocket` 3.10.5.1 and `clearfy-pro` 3.5.3.
- **WP-CLI needs `--skip-themes` there**, not just `--skip-plugins=clearfy-pro`: the CLI's PHP is 8.2 while the site runs older, so `welfare/functions.php:754` fatals on every command otherwise.
- **The Yandex Metrica counter is `34478865`**, read off prod's own tag — A4 no longer has to wait for someone to look it up.
- **od-dev's page 36316 is a *different, older document***, last touched 2017-11-18: a generic template naming «**ООО** «Общее дело»» — not even the right legal form. The current legal text exists only on prod. Anything that serves `/conf_politics/` must read the frozen copy or prod, never od-dev.
- **Prod still loads `fonts.googleapis.com` + `fonts.gstatic.com`** on every page. That is the same cross-border request pattern GA and the VK pixel were removed for, and it is not disclosed in the policy. Not fixed here — it is legacy-theme work with a short shelf life — but it is the honest next candidate if anyone revisits prod's compliance. The app is unaffected: `next/font` self-hosts at build time.

---

## 6. Research — the live site (2026-05-29)

The redesign replaces an existing site. Facts harvested from a live read, used throughout the plan:

- **Scale.** Sitemap index reports ~500–1000+ URLs across 11 child sitemaps. Confirms Materials is real volume, not a Figma exaggeration.
- **No on-site search.** Header search on the redesign is **net-new**. *Since resolved as in-scope* — the canonical `header-v2` component embeds a styled search input, so it's part of the header design rather than an optional icon (B7).
- **No language switcher.** Russian-only is permanent — no `next-intl`/`i18next`.
- **No embedded forms anywhere.** Contact, participation, "leave a review" and "suggest an idea" all route via email or external services (`reformal.ru`). Every form in the redesign is **net-new** (B6).
- **Analytics.** The live privacy policy named **Yandex Metrica + Google Analytics**, but **GA is no longer usable** under current Russian regulations. *Since resolved* — GA and the VK pixel were removed from prod on 2026-08-07 and the policy's §5.6 now names Метрика alone (counter **34478865**); see the F6 note in §5.
- **Foreign-service caveat — narrower than first framed.** The site serves **public content only**, so hosting, CDN, image optimisation and asset delivery can sit abroad without 152-FZ data-localisation concerns. The restrictions bite at **PII entry points and PII-touching telemetry**: analytics (→ Metrica only), captcha (→ Yandex SmartCaptcha, not reCAPTCHA), and where form data lands. Form submissions are settled: they post into the existing RU-hosted WordPress (B6).
- **Legal posture.** Registered СМИ under Roskomnadzor (cert Эл № ФC77-72346, 14 Feb 2018), "12+" content rating — the footer must preserve both. Privacy policy is **152-FZ only; no GDPR**. Legal entity: «Общероссийская общественная организация поддержки президентских инициатив в области здоровьесбережения нации "Общее дело"», ОГРН 1127799010624.
- **Content taxonomy is firmer than Figma suggests.** Films split into 5 sub-categories (matches `video-filter` intent); Materials into ~14 sub-pages; About has **11** sub-pages on the live site (organisation, team, activist stories, media coverage, partners, certificate, charter, expert reviews, thank-you letters, documents, statistics) — more than Figma mocks.
- **Section label drift.** Live site calls the section **«ПРОГРАММЫ»** (`/projects/`); the Figma section is **«проекты»**. Figma's own canonical `header-v2` nav spells it «ПРОГРАММЫ», agreeing with the live site.
- **External / sibling properties** — links into them, not implementations of them: **`общее-дело.рф`** (punycode `xn----9sbkcac6brh7h.xn--p1ai`, alt domain, already allowlisted in `images.remotePatterns`), **`pro.obshee-delo.ru`** («ОБЩЕЕДЕЛО-ПРО» — *not* `od-pro.ru`, which prod's nav links to but which serves a separate contest landing; see C9), **`помоги.общее-дело.рф`** (donations), **`статы.общее-дело.рф`** (statistics dashboard), **`reformal.ru/od1`** (suggest-an-idea form).
- **Pages the live site has that Figma doesn't mock** — worth raising with Design: `/about/smi/`, `/about/nashi_partnery/`, `/about/experts-review/`, `/about/reviews/`, `/about/ostavit-otziv/`, `/sp/`, `/sitemap/`.
- **174 published `wp/v2/pages`** (re-confirmed 2026-08-13) — regional pages (~40), programmes, materials, legal, team, plus a long tail. This is what A6 exists for.

---

## 7. Research — traffic (Yandex Metrica, 91 days)

Exports: `Популярное` (pageviews) + `Страницы входа` (entry visits), 2026-05-14 → 2026-08-13. **22 881 visitors · 27 076 visits · 59 041 pageviews** — about **250 visitors/day**. Small in absolute terms, which is itself a finding: this is not a property where a launch-day SEO dip is existential.

The files live outside the repo, at `~/Documents/od/ya.metrika/`. Both export **leaf rows only** (`Не определено` marks the terminal level), so summing every row reproduces the `Итого` line exactly. The metric columns are **not** in the same position in the two files.

### Two metrics, two answers

**Entry visits** = what search engines send traffic to — the traffic the A6 iframe degrades. **Pageviews** = what visitors consult once inside — which under A6 is *not* free either, since the body is the old design in an iframe.

They rank differently, and the gap is big enough to change decisions:

| | views | entries |
|---|---:|---:|
| built routes | 45 604 (**77.2 %**) | 23 037 (**85.1 %**) |
| legacy redirects | 1 608 (2.7 %) | 394 (1.5 %) |
| **A6 fallback** | **11 829 (20.0 %)** | **3 645 (13.5 %)** |

So the SEO exposure is 13.5 % but the *visible* exposure is 20.0 % — one pageview in five.

**`v/e` (views ÷ entries) is the tell.** High = a nav destination reached by clicking; low = a search landing. `/news/` is 21×, `/projects/` 9.3×, `/materials/` index 8.8×, `/contacts/` and `/get-involved/` 7.0×, `/about/` 4.5×, `/profile/*` **1.6×** — the lowest on the site.

*Historical note:* this plan originally ranked by entries alone and justified it with "pageviews measure what people browse to once they're inside — the new header/footer serves that fine either way." That is false under A6, where the **body** is an iframe. Corrected 2026-08-13.

### Findings

- **Video is 44 % of the whole site.** `/video/*` 12 789 + film detail 12 557 + `/category/video/*` 792 = **26 138 views**, **8 236 entries (30.6 %)**. D7 was the right thing to build first, and finishing B-VIDEO2 protects the largest single block of traffic.
- **The post-detail long tail is long but concentrated.** 3 517 distinct `/<id>/` URLs; the top 100 carry 73 % of the section's views and only **141 pages clear 10 views** in 91 days. ISR + `dynamicParams` is exactly right — prerendering more than a few dozen would be wasted. 56 % of those views are catalogue films; the rest is news, «Статьи» (578) and «Видео события» (52) reports, all with a working detail route.
- **Materials was under-prioritised.** The plan said "build last" (Block 6), but it is #3 by entries and `/materials/plakati/` is the **#6 entry page on the entire site** (501 entries, 13 % bounce, 1.8 pages deep) — a strong search landing that would be a poor iframe. **4 of the 14 sub-pages carry 62 % of the section's entries**: plakati 501 · zakladki 150 · articles 114 · metodichki 56.
- **Profiles win on entries; About wins on views.** By entries `/profile/*` **566** > `/about/*` **345** > `/team/` **65**, so the profile detail template is what protects search traffic — though 334 of the 566 are one record (`moiseev-oleg-olegovich`) and the other 139 URLs average 1.7 entries each. By views the order reverses: `/about/*` **1 771** > `/profile/*` **926**, and the single page `/about/` (1 036) outdraws the entire 140-URL profile section. Both readings are correct and imply different work.
- **D6 has no project-detail traffic at all** — zero `/projects/<something>/` URLs in 91 days. The real «программы» are the three top-level `/healthy-*` pages. Corroborates B-CPT's finding that the `project` CPT is 21 Lorem-ipsum drafts. `/projects/` itself is 794 views / 85 entries (**9.3×**) — the index is worth more than its entry count implies even though the detail template is worth nothing.

### Section table

Sorted by entries.

| Section | Views | Entries | % entries | `v/e` |
|---|---:|---:|---:|---:|
| Post detail `/<id>/` | 23 529 | 12 530 | **46.5 %** | 1.9 |
| Home `/` | 8 890 | 6 989 | **25.9 %** | 1.3 |
| `/video/*` (5 sub-pages) | 12 789 | 3 328 | **12.3 %** | 3.8 |
| `/materials/*` (14 sub-pages) | 3 981 | 1 327 | 4.9 % | 3.0 |
| `/profile/*` (140 URLs seen) | 926 | 566 | 2.1 % | **1.6** |
| `/contacts/` (index + 124 regions) | 1 521 | 547 | 2.0 % | 2.8 |
| `/about/*` (11 sub-pages) | **1 771** | 345 | 1.3 % | 5.1 |
| `/category/*` | 1 019 | 301 | 1.1 % | 3.4 |
| `/get-involved/*` (18 pages) | 932 | 262 | 1.0 % | 3.6 |
| `/healthy-russia\|youth\|kids/` | 701 | 258 | 0.9 % | 2.7 |
| `/projects/` | 794 | 85 | 0.3 % | **9.3** |
| `/team/` | 326 | 65 | 0.2 % | 5.0 |
| `/actual/`, `/faq/`, `/sitemap/`, `/sp/`, `/sms/`, `/conf_politics/`, `/rekvizit/`, … | < 300 ea | < 50 ea | < 0.2 % ea | — |

---

## 8. Answered questions and superseded decisions

Kept so the same questions don't get re-opened.

### Content modelling

- ~~Are `project-1/2/3` hard-coded pages or CMS-driven entries?~~ — the `project` CPT holds **21 Lorem-ipsum 2015 drafts, 0 published** (re-confirmed over REST 2026-08-13) and is being deleted with cmsms; the real «программы» are plain WP pages (`/healthy-russia|youth|kids/`). *Still open:* whether the three Figma `project-1/2/3` mocks correspond to anything real (D6).
- ~~Are team members a CPT with photo/bio fields, or static JSON?~~ — the `profile` CPT, **205 records (139 published)**, bodies **already migrated to Gutenberg** by `cmsms-gutenberg-upgrade`, so no data-migration script is needed. *Still open:* whether editors want `region`/`phone`/`email` promoted to ACF fields instead of living in the body (B8 step 3).
- ~~How will news categories surface in the UI?~~ — partly: the D2 chips filter by category (`Все / Наши дела / Статьи`). *Still open:* WP has ~80 **region** categories (`oblast` children: Ростовская обл. 322 posts, …) and a top-level `Региональные новости` (547), which the design doesn't spec.

### Behaviour

- ~~"Скачать фильм" — modal or dedicated page?~~ — **neither.** The D7 fidelity pass settled it: downloads are inline pills in the film page's hero card, per `video-page` (`1566:10433`). *Still open:* tracked vs anonymous download (needs A4).
- ~~Does the site need a global search?~~ — **yes**, reversing the earlier reading: `header-v2` embeds a styled search input, so it ships with the header. Endpoint settled as `GET /wp/v2/search` (B7).
- ~~Multilingual support?~~ — **Russian only** (no language switcher on the live site).

### Design

- ~~Button corner radius: 5px or pill?~~ — **pill.** Canonical Figma Button is `cornerRadius:9999`; the repo Theme is `radius="full"`. They match. The "5px" reading came from a superseded master (`1321:5304`).
- ~~Are there 3 or 5 «направления» on the home page?~~ — **5.** The canonical frame just clips the overflow cards.

### Infra

- ~~Where does this deploy?~~ — **Beget VPS running Coolify, images built in GitHub Actions → GHCR** (A2). *Still open:* who holds the Coolify/GHCR credentials, and whether stage and prod are two apps on the one VPS (the sizing assumes yes).

### Superseded plan text

- **"`/category/*` — legacy alias of `/video/*`"** — true of 94 % of the family; the rest 404'd until the catch-all landed. See §1.
- **"Rank sections by entry visits, not pageviews"** with the justification that the header/footer covers browsing — false under A6. See §7.
- **"`/materials/articles/` is not a build at all"** — it needed a thin alias route, now shipped. See §3.
- **Route shapes `/news/<id>` and `/video/<id>`** — this project's own pre-launch invention. They 404 by design; don't "fix" them.
- **`FILM_CATEGORY_IDS` as an array** — replaced by `FILM_CATEGORIES` keyed by URL segment (A8).

---

## 9. Simplification pass — 2026-08-14

A repo-wide audit for over-engineering, applied in blocks. What it removed, and
what to know before adding any of it back:

- **`Programs`** — a byte-identical copy of `Directions` behind a switch that
  static config pinned to `true`. See §3 D1.
- **Five dependencies** — `autoprefixer` and `postcss-flexbugs-fixes` (the first
  is inside `postcss-preset-env`, which runs it off the same browserslist; the
  second patches an IE bug and this browserslist has no IE), plus `nanoid`,
  `postcss-loader` and `postcss-discard-comments`, which nothing imported.
- **`dayjs`** → `src/shared/lib/formatDate.ts`. Every call site was
  `format('DD.MM.YYYY')`, which is `Intl.DateTimeFormat('ru-RU')` with 2-digit
  day and month. The `dayjs.locale('ru')` calls did nothing — the format is
  numeric.
- **Nineteen icon wrapper files → one.** The SVG set in `assets/icons/` is the
  design set and stays whole; the wrapper list is only what something renders.
- **`SubscribeToNews`** — a second, non-functional subscribe form (no state, no
  handler, a `variant="default"` branch rendering the literal string «Not
  inplemented», and its own consent link pointing at `/`). The news article
  sidebar now renders `NewsletterSignup variant="narrow"`, so there is one form,
  one consent link and one place for #54 to wire submission.
- **`LEGACY_DENYLIST`** — shipped empty by design (A6 decision D12). Retiring a
  legacy page is a native route or a redirect; if a list is ever wanted back it
  is three lines in `isEmbeddable.ts`.
- **`Box`'s 3 528-line CSS module → 353 → 140 lines.** It generated a class per
  property *per value* across four breakpoints; the app used about thirty of
  them, and the twelve-step scale was the reason §2.2 of the design system told
  you to round Figma's numbers. Values now ride in an inline custom property, so
  the scale is gone. Verified by diffing the bounding box of every element on
  five pages at 1440 and 390 before and after — the only differences were the
  x-offsets of the two animated hero marquees. The second pass cut the **prop
  list** the same way: 15 of the 24 properties (`p`, `pr`, `pl`, `px`, `m`,
  `mt`, `mr`, `ml`, `mx`, `my`, `bottom`, `left`, `right`, `flexWrap`,
  `justifyContent`, `alignItems`, `alignContent`) had no call site anywhere.
  Nine remain: `pt`, `pb`, `py`, `mb`, `gap`, `top`, `display`,
  `flexDirection`, `position`. Adding one back is a line in the type, an entry
  in `LENGTH_PROPS`/`KEYWORD_PROPS`, and three lines per breakpoint in the CSS —
  use `Box`'s own `className` escape hatch if it's a one-off.
- **`Input`'s label, hint message, error state and leading icon** — four of its
  six own props, 90 of its 240 lines, and not one call site passed any of them:
  the header search and the newsletter field both label with `aria-label` and
  validate with native `required`. The always-rendered empty `<Text>` under every
  input and the wrapper `<div>` went with them (Radix's `TextFieldRoot` is
  `display: flex` and stretches the same either way). Figma still draws all four
  — see design-system §5's `Input Field` row before rebuilding one.
- **Two stale assertions in `e2e/home.spec.ts`**, both wrong since the harness
  landed (`764a6e2`) and invisible because e2e is not in CI: it asserted separate
  «Программы» and «Направления деятельности» headings, which have been one
  merged section since `HOME_SECTIONS_TITLE`, and it looked for the hero CTAs by
  `role=button` when both are `<Button asChild>` around an anchor. Fixed rather
  than deleted; all 60 tests now pass against a production build (`pnpm build &&
  pnpm start`), which is also where the A8 gate was re-run: **98.9 % entry-traffic
  coverage over the top 200 URLs**, the remainder being three `/<id>/` posts
  absent from od-dev and two `/profile/` pages.
- **Branches nothing could reach.** `ButtonGroupItem`'s `contentProps`
  passthrough (its one caller never set it) and the `.trigger` rule no element
  carried; `ButtonGroupSubMenu`'s `links = []` default and `if (!links?.length)`
  guard, when `ButtonGroup` only renders it for an item that has children;
  `Accordion`'s `AccordionSingleProps | AccordionMultipleProps` union with one
  caller passing `type="multiple"`; the Gutenberg carousel adapter parsing
  `data-cb-space-between` and `JSON.parse`-ing `data-cb-breakpoints`, both of
  which `createSwiperConfig` then overrode with its own values; `Directions`'s
  `title` default, always overridden by `HOME_SECTIONS_TITLE`;
  `DIRECTIONS`'s hidden-set filter, which was ten lines of machinery to
  express a two-item list (the three absent titles are now a comment, which is
  where the reason lived anyway); `variant="card"` spelled out at the four
  `NewsletterSignup` call sites that were already getting the default; and the
  hand-rolled `sleep` in `sitemap.ts`, which is `setTimeout` from
  `node:timers/promises`.
- **`modules/Header/utils/` — five modules and five test files → three.**
  `sortNavItems` (10 lines) and `mapWpMenuItemToNavItem` (12) had one caller
  each, `toNavItems`, and its own barrel exported them to nobody. They are local
  helpers inside `toNavItems.ts` now; `toInternalHref` stays its own file because
  its URL rules are genuinely separate and its test earns its keep.
  `mapWpMenuItemToNavItem.test.ts` was three `toInternalHref` assertions in
  disguise; `sortNavItems.test.ts` asserted that it sorted **in place**, which
  was a wart — the helper copies now, and `toNavItems.test.ts` gained the case
  that actually matters: a child WordPress listed before its parent.
- **Seven hand-rolled argv loops → `parseArgs` from `node:util`.** Each script
  had a ~17-line `for` loop over `process.argv`, and each got the error handling
  slightly differently: `--top` with no value silently became `Number(undefined)`
  = `NaN`, and `--out=sheet.csv` wasn't recognised anywhere. `parseArgs` rejects
  both, so the scripts are down to an option table. The one wrinkle is in
  `scripts/lib/args.mjs`: `pnpm run x -- --flag` forwards the bare `--` as the
  *first* argument, which `parseArgs` reads as "the rest are positionals", so it
  is filtered out before the call. Still zero-dependency.
- **Barrel lines with no importer.** `shared/legacy/index.ts` re-exported the
  transform, the store, the loader factory and `legacyOrigin`, none of which
  anything imports through the barrel — they are reached by module path from
  inside the folder or from `src/proxy.ts`. `shared/api/index.ts` re-exported
  `fetchNews`/`cachedFetchNews`/`fetchVideo` alongside the module paths that are
  actually used, plus eight unused type re-exports; `modules/Home/index.ts` three.
  Two names for one function is how a test ends up mocking the wrong one.
  `fetchSearch` deliberately stays in the api barrel: it has no consumer yet
  (B7's UI), and this is the name that page will import.
- **`react-hooks/rules-of-hooks: error`** — the line right above it spreads
  `reactHooksPlugin.configs.recommended.rules`, which sets exactly that. Plus
  `eslint.config.mjs`'s `__filename`/`__dirname` and the two Node imports behind
  them, computed and never read.
- **Four `forwardRef` wrappers and five `displayName` assignments** — `Button`,
  `IconButton`, `Checkbox`, `Input` (+ `HeaderClient`). No call site passes a
  `ref`, and Radix's own exported prop types are `ComponentPropsWithoutRef`, so
  the ref never had a route in from the outside either. Under React 19 `ref` is
  an ordinary prop: if one is ever needed it is `ref` in the destructure, not a
  wrapper. `displayName` only ever existed to stop DevTools printing
  `ForwardRef`.
- **Repo-invented props on five primitives**, each with zero call sites and no
  cell in the Figma set behind it: `Link`'s `leftIcon`/`rightIcon` (every cell in
  the `Links` matrix is text-only) and the `.inlineFlex` they switched on,
  `Tabs`'s `icon` and the `.tab svg` rule sizing it, `Carousel`'s
  `showNavigation`/`showPagination`/`className`, `Pagination`'s `siblings` and
  `aria-label` overrides, `Breadcrumbs`'s `Separator`. **What stayed, and why:**
  `Link`'s `white` colour and `disabled` state, and `Tabs`'s `size` and
  `disabled` — those are Figma variants (see the `Links` matrix and the
  `_Button Groups Base` (tabs) row in design-system §3.2), so an unused one is a
  realized spec cell, not speculation.
- **One entity decoder** (`src/shared/lib/decodeEntities.ts`) — there was a
  twenty-entry table in `shared/legacy/html.ts` and an eleven-entry one in
  `shared/api/newsPreview.ts`, the second of which silently dropped anything it
  didn't know. The two *tag*-strippers stay separate on purpose: one replaces a
  tag with nothing (preview text, matching `textContent`) and the other with a
  space (anchor labels), and merging them would move rendered copy.
- **`Container`** — a `<main>` wrapper with one caller, which the design system
  had to warn readers not to confuse with Radix's `Container`. It is `.main` in
  `src/app/layout.module.css` now.
- **`SHOW_PRO_IN_NAV`** — a `const false` feeding a one-element `Set`.
- **`legacyStore.clear()`** — on the interface, implemented, never called.

### What the audit flagged and the code **refused**

Each of these looked like an easy cut and isn't. Don't re-file them.

- **`createLegacyLoader`'s eight injectable deps** look like a DI container with
  one production caller, but `loadLegacyDocument.test.ts` overrides all eight —
  `maxBytes`, `timeoutMs` and `revalidateSeconds` included.
- **`cssnano` in `postcss.config.js`** looked redundant because `next build`
  minifies CSS itself — and it does, thoroughly (`--gray-8:#bbb` in the output is
  its work, not cssnano's). Measured anyway, over a full production build:
  **895 923 bytes of emitted CSS with cssnano, 904 003 without.** It earns 8 080
  bytes (0.9 %) on top of Next's own pass, mostly out of the 680 KB Radix bundle.
  It stays.
- **The six SVGs in `assets/icons/` with no wrapper** (`chevron-up`,
  `cross-circle-filled`, `exclamation-outlined`, `info-outlined`, `vk-circle`,
  `warning`) — the icon set is the *design* set and stays whole, as the
  nineteen-wrappers bullet above already says.
- **`POST /api/revalidate/`'s `postId` and `paths`.** `postId` duplicates
  `postIds` and nothing sends it; `paths` has no caller at all. Both are
  deliberate: `postId` is documented as the hand-written-curl form
  ([wp-backend §6.5](./wp-backend.md)), and `paths` is what the mu-plugin will
  need for legacy **pages** when A6 ships, which the runbook already names as a
  known gap.
- **`fetchSearch`** (117 lines + 134 of test, no caller) — B7's data layer, kept
  by decision: its blocker is two design questions about the results page, not
  the fetcher.
- **`Link`'s `white`/`disabled`, `Tabs`'s `size`/`disabled`, `Checkbox`'s
  no-label branch** — unused, and all four are cells in a Figma component set
  this project tracks parity against. An unrealized spec cell is a gap; a
  realized one that nothing happens to call yet is not waste.
