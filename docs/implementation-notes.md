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

---

## 2. Shipped — design system (C)

**C1–C8 are done; C9–C11 are open** (see the plan). Per-component drift notes live in [`design-system.md` §4](./design-system.md).

- **C1. `Button`** — 2026-05-30 with D1, `src/shared/ui/components/Button/`, maps intent → Radix variant + size. Figma matrix confirmed: 3 Variant (`Contained`/`Outline`/`white`) × 3 Size × 3 State = 27 cells. Canonical Contained/Large: `cornerRadius:9999`, fill `#AE0A04`, padding 12/24, label `text/4/regular`. The `white` variant is the donation CTA on the red header. **The corner-radius question is resolved** — canonical Figma Button is pill, repo Theme is `radius="full"`; the old "5px" reading came from a superseded master (`1321:5304`).
- **C2. `IconButton`** — 2026-05-30 with D1. 2 Radius (Curved 8px / Circle) × 2 Variant × 3 State = 12 cells, 32×32 base. Header-mob search/menu, carousel arrows.
- **C3. `PageHeader`** — 2026-06-03. **Reframed from "hero" to "top-of-page block".** Figma's `page header` (`1335:7682`) is not a banner: it composes header-v2 (instance) + breadcrumbs + page heading (`text/9/bold`, PT Sans Narrow Bold 48, `brand/red/7`) + tabs row. Built as a layout shell rendering optional `<Breadcrumbs>` + the red uppercase H1 + an optional `tabs` slot. The header-v2 instance is **not** re-rendered here — it's the global `modules/Header` from the root layout. Server component. `/news` was refactored onto it, proving reuse.
- **C4. `Pagination`** — 2026-06-03 with D2. Link-based (each page a `<NextLink>`, so RSC with no client JS), windowed range (`getPaginationRange`, pure + unit-tested), prev/next chevrons, ellipsis, active cell `--red-8`, disabled edge arrows, `aria-current="page"`. **Open drift:** cells render 40×40/r8 (measured off the `news` frame instance) vs the canonical component `1326:2018` spec of 36×36/r6. The mobile variant (`1567:12545`) isn't a separate render — the same component flex-shrinks to ≤390 with no overflow.
- **C5. `Tabs`** — 2026-06-03. Figma `_Button Groups Base (tabs)` (`1321:5108`, 12 variants, r8) — distinct from the nav `_Button Groups Base`. **Link-based**, since every confirmed use is URL-driven sub-section switching. All six Figma hexes mapped to existing tokens (`#344051`→`--gray-8`, `#ffeaea`→`--red-1`, `#5c0302`→`--red-10`, `#97a1af`→`--gray-5`, `#f9fafb`→`--gray-1`, `#ffcfcf`→`--red-2`). **Note:** the *controlled client-state* variant for D9's role tabs isn't built — add a `TabsControlled` sibling when D9 lands.
- **C6. `Dropdown`** — 2026-06-04. **Single-select** on Radix Themes `Select`, client component, controlled `value` + `onValueChange`. Faithful to Figma `Dropdown Menu` (`1324:4234`). **Deferred:** the multi-select + checkbox-list + removable-chip variant from the same set — add when Materials needs it. **Not satisfied by the header `ButtonGroupSubMenu`**, which is a Radix `NavigationMenuSub` nav-link flyout — a different component with a different role.
- **C7. `Checkbox`** — 2026-05-30 with D1 (newsletter signup). Figma `Checkbox` (`1323:257`, 12 variants), 16×16, r4, gray-4 stroke.
- **C8. `Carousel`** — 2026-05-30 with D1 (Swiper-backed). Figma provides only the **chrome**: `_Carousel Button Base` (32×32 circle arrows) and `_Carousel Page Indicator Base/Small/Dot` (8×8 dots, active `brand/red/7`). The slider container itself is unspecified.

---

## 3. Shipped — pages (D)

### D1. Home (`app/page.tsx`) — 2026-05-30, reviewed and signed off 2026-06-01

Figma reference frames on the `design` page: `home` 1440 (`3614:91040`, canonical desktop — re-pasted 2026-05-30, old `889:3761` parked off-canvas), `home` 900 (`1622:10641`), `home-mob` (`1356:15986`), plus `главная` (`3612:11235`) as an exploration board. Composition in [`page-mocks.md` §2.1](./page-mocks.md#21-home-top-level-frames-no-section-wrapper) — nine sections shipped as Hero, StatsRow, FilmsCarousel, NarrowPromo, Directions, Programs, NewsGrid, NewsletterSignup. Async RSC with `revalidate=3600`; pulls `?format=video` for the films carousel and the latest 4 posts for the news grid. C1/C2/C7/C8 landed alongside; NewsCard + NewsletterSignup were lifted as shared modules for D2/D4/D7/D8 reuse.

**Review pass 2026-06-01:** wired all CTAs (Hero donate → external donation URL, participate → `/get-involved`, Films→`/video`, News→`/news`); fixed the Hero mosaic grid bug (tiles with no slot were 0-height phantoms); film thumbnails moved to `next/image`; Directions/Programs/FilmsCarousel dropped `'use client'` (server components now, only the inner Carousel is client); newsletter email got an accessible name; StatsRow became a `<ul>/<li>`; Header `/test` placeholders repointed; CTA labels set to «Все фильмы» / «Все новости». The dev-only Radix hydration warning was confirmed **absent in production**.

**Deferred, not D1-blocking:** Directions/Programs entries stay hard-coded pending #32 (sections-fetch); the proper 900-tier landing is A1b; the `/materials` nav prefetch 404 clears when D8 ships. The 900-wide variant currently uses the desktop layout collapsed via the 3-tier breakpoints.

*Resolved along the way:* the 5-vs-3 directions question — 5 is correct; the canonical frame just clips overflow cards.

**GitHub:** pre-decomposed into #33 Hero, #34 Statistics, #35 Films carousel, #36 Banner, #37 Programs carousel, #38 Articles, #39 Subscribe — all now have shipped markup. **#32 (open)** still tracks "how do we fetch sections" (working assumption: widgets).

### D2. News index (`app/news/page.tsx`) — 2026-06-03

Frame `753:418`. Async RSC, `revalidate=3600`, **dynamic** (driven by `?category=` / `?page=`). Breadcrumbs + red uppercase `НОВОСТИ` H1 + filter chips + a 3-column `NewsCard` grid (15/page → 3 cols desktop / 2 small-desktop / 1 mobile) + C4 `Pagination` + `NewsletterSignup variant="card"`.

Data via `fetchNewsList` (`src/shared/api/fetchNewsList.ts`) — paginated `/wp/v2/posts` reading `X-WP-Total{,Pages}`, optional `categories` filter, thumbnails through `resolveMediaUrl`, hour-cached, returns empty on a non-2xx (WP 400s an out-of-range page) rather than throwing.

**Filter chips** (`src/modules/News/NewsFilter/`): `Все` = unfiltered · `Наши дела` → category `Новости` (47) · `Статьи` → `articles` (578). There is no dedicated «Наши дела» WP category, so it maps to the main news category. Ids live in `src/shared/config/newsCategories.ts` since 2026-08-13.

**GitHub:** newsletter *submission* wiring still open (#54); markup side is #66/#39.

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

`POST /api/revalidate/` (`src/app/api/revalidate/route.ts`), secret-gated by `REVALIDATE_SECRET` in an `x-revalidate-secret` header. Body is `{postId}`, `{tags}` or `{paths}`; answers 200 with what it purged, 401 on a bad secret, **503 when no secret is configured** so a half-configured tier is inert rather than open, 400 for everything else.

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

**Nothing calls it yet.** The WordPress half is an mu-plugin (so it survives the §4.5 theme swap) written out in [`wp-backend.md` §6.5](./wp-backend.md), and needs WP access plus confirmation that Timeweb allows outbound HTTP from hooks. Also note the endpoint must be posted **with** its trailing slash — the slashless form is a 308, verified, same trap as `/health/`.

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

---

## 6. Research — the live site (2026-05-29)

The redesign replaces an existing site. Facts harvested from a live read, used throughout the plan:

- **Scale.** Sitemap index reports ~500–1000+ URLs across 11 child sitemaps. Confirms Materials is real volume, not a Figma exaggeration.
- **No on-site search.** Header search on the redesign is **net-new**. *Since resolved as in-scope* — the canonical `header-v2` component embeds a styled search input, so it's part of the header design rather than an optional icon (B7).
- **No language switcher.** Russian-only is permanent — no `next-intl`/`i18next`.
- **No embedded forms anywhere.** Contact, participation, "leave a review" and "suggest an idea" all route via email or external services (`reformal.ru`). Every form in the redesign is **net-new** (B6).
- **Analytics.** The live privacy policy names **Yandex Metrica + Google Analytics**, but **GA is no longer usable** under current Russian regulations. Redesign drops GA. The ported privacy copy must lose the GA reference — the live page is stale on this.
- **Foreign-service caveat — narrower than first framed.** The site serves **public content only**, so hosting, CDN, image optimisation and asset delivery can sit abroad without 152-FZ data-localisation concerns. The restrictions bite at **PII entry points and PII-touching telemetry**: analytics (→ Metrica only), captcha (→ Yandex SmartCaptcha, not reCAPTCHA), and where form data lands. Form submissions are settled: they post into the existing RU-hosted WordPress (B6).
- **Legal posture.** Registered СМИ under Roskomnadzor (cert Эл № ФC77-72346, 14 Feb 2018), "12+" content rating — the footer must preserve both. Privacy policy is **152-FZ only; no GDPR**. Legal entity: «Общероссийская общественная организация поддержки президентских инициатив в области здоровьесбережения нации "Общее дело"», ОГРН 1127799010624.
- **Content taxonomy is firmer than Figma suggests.** Films split into 5 sub-categories (matches `video-filter` intent); Materials into ~14 sub-pages; About has **11** sub-pages on the live site (organisation, team, activist stories, media coverage, partners, certificate, charter, expert reviews, thank-you letters, documents, statistics) — more than Figma mocks.
- **Section label drift.** Live site calls the section **«ПРОГРАММЫ»** (`/projects/`); the Figma section is **«проекты»**. Figma's own canonical `header-v2` nav spells it «ПРОГРАММЫ», agreeing with the live site.
- **External / sibling properties** — links into them, not implementations of them: **`общее-дело.рф`** (punycode `xn----9sbkcac6brh7h.xn--p1ai`, alt domain, already allowlisted in `images.remotePatterns`), **`od-pro.ru`** («ОБЩЕЕДЕЛО-ПРО»), **`помоги.общее-дело.рф`** (donations), **`статы.общее-дело.рф`** (statistics dashboard), **`reformal.ru/od1`** (suggest-an-idea form).
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
