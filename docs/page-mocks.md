# Page mocks — Figma ↔ Repo

This is the companion to [`design-system.md`](./design-system.md). That file maps the `👉 UI` page (the design system). **This file maps the `design` page** — the page mocks that consume the design system — and tracks which mocks have been built as Next.js routes.

Last verified against Figma: **2026-05-30** (deep scout via the `figma-mcp-go` MCP on the `design` page itself, page id `168:717`). Repo-side status last verified against the code: **2026-08-13**.

---

## 1. How the `design` page is organized

The `design` page (id `168:717`) is one of three pages in this Figma file (alongside `👉 UI` and `draft`). Top-level structure as confirmed by the scout:

1. **7 `SECTION` containers**, one per site section (`о нас`, `проекты`, `видео`, `контакты`, `новости`, `Ответы на частые вопросы`, `Материалы`). These are the canonical home for page mocks — anything that ships should live inside a section.
2. **Top-level home frames** — outside any section: `home` (1440-wide desktop `3614:91040`), `home` (900-wide responsive variant `1622:10641`), `home-mob` (`1356:15986`), and `главная` (`3612:11235`, a much larger multi-screen exploration). The home page never made it into its own SECTION; treat these four frames as its canonical mocks. The 1440 desktop frame was re-pasted on 2026-05-30 (previous id `889:3761` is still on canvas but parked at x=60811 off the working area — ignore it).
3. **Loose legacy frames** (~30+) — earlier iterations, exploration scratch, an older component library that predates the `👉 UI` page. Treat as non-canonical.

`SECTION` nodes also contain `Status` instances — green / yellow pills from a Figma tracking template (Inter, white-on-fill — see [`design-system.md` §3.2](./design-system.md#32-components-defined-on-the--ui-page)). These are **workflow annotations, not UI**: ignore them when building.

Throughout this doc, frame names ending in `-mob` are mobile variants (360-wide) of the desktop frame with the same base name.

---

## 2. Sections — design ↔ repo route map

Status legend: ✅ implemented, ⚠️ partial, ❌ not built.

### 2.1 Home (top-level frames, no SECTION wrapper)

Three responsive variants plus a multi-screen exploration — all live as top-level frames on the `design` page, not under a SECTION.

| Frame | ID | Width × height | Header | Footer | Notes |
| --- | --- | --- | --- | --- | --- |
| `home` (desktop) | `3614:91040` | 1440 × 5139 | `header-v2` INSTANCE | `footer` INSTANCE | **Canonical desktop target.** Consumes design-system components cleanly. Re-pasted 2026-05-30 (superseded `889:3761`); inner sub-frame numeric IDs all changed too — anchor by Figma frame NAME (`Frame 33799`, `Frame 33808`, etc.), not by ID. |
| `home` (responsive) | `1622:10641` | 900 × 4803 | inline `900` frame (`1622:12252`), not a component | inline `footer-900` frame (`1622:12335`) | 900-wide breakpoint demo. Header + footer are hand-laid frames here — not yet promoted to the `header-v2 (1200)` / `footer (1200)` components Design has on the `👉 UI` `navigation` frame. |
| `home-mob` | `1356:15986` | 360 × 9221 | `header-mob` INSTANCE (`1356:15987`) | `footer-mob` INSTANCE (`1356:17651`) | Canonical mobile target. |
| `главная` (multi-screen flow) | `3612:11235` | 6684 × 11531 | — | — | Exploration board containing earlier card variants, the `Status` workflow component, and bits that didn't ship to the three canonical frames. Reference only. |

#### Section composition shared across all three breakpoints

All three responsive variants share the same nine-section stack. This is the build target for D1.

| # | Section frame name (Figma) | What it is | Primitives consumed |
| --- | --- | --- | --- |
| 0 | header (per breakpoint) | top chrome | `header-v2` / hand-laid 900 / `header-mob` |
| 1 | `Frame 33799` + `Frame 33795` | Hero composite — opening pitch on the left, twin CTA buttons on the right | `Button` (×2) |
| 2 | `Frame 33808` | 4-card identity / stats row (`Frame 33804/05/06/07`) — 4-up at 1440, 4-up tighter at 900, 2×2 grid at mobile | none (text + illustration) |
| 3 | `Frame 33815` (carousel #1) | 3-card carousel: 3-up at desktop, 1-up + peek at mobile. Carousel chrome + CTA below | `Carousel` chrome (`_Carousel Button Base` + `_Carousel Page Indicator Base/Small/Dot`), `Button` (CTA "Узнать больше") |
| 4 | `Frame 33817` | Narrow quote / promo block with single `Button` | `Button` |
| 5 | `Frame 33824` (carousel #2) | 3-card link-card carousel — Illustration + `Links` per card; chevron arrows at edges + dot indicator | `Carousel` chrome, `Links` |
| 6 | `Frame 33825` (carousel #3) | Same pattern as carousel #2, different content set | `Carousel` chrome, `Links` |
| 7 | `Frame 33833` | News section — **2 rows, not a flat grid**: one **featured** item on top (`Frame 33826` = image left 597×324 + date/title/**excerpt** right) then a row of **4 compact cards** (`Frame 33827/28/29/30`, image 280×216 + date + 2-line title below, in `Frame 170/171/172/173`) + CTA below (frame text is «Посмотреть все»; repo ships «Все новости»). **5 items total.** | `Button`, news card pattern |
| 8 | `Frame 33837` | Newsletter signup: `Frame 33835` = `Input Field` (email) + `Button` ("Подписаться") + `Checkbox` (consent below) | `Input Field`, `Button`, `Checkbox` |
| 9 | footer (per breakpoint) | bottom chrome | `footer` / `footer-900` / `footer-mob` |

The card frame names (`Frame 33808`, `Frame 33815`, etc.) recur identically across breakpoints — useful as anchors when comparing 1440 ↔ 900 ↔ 360.

> **Directions/Programs card counts — not a frame discrepancy.** The home carousels ship **5 direction cards** and **3 program cards**. The canonical `home` frame visually shows only 3 direction cards because Figma clips whatever overflows the frame width — the extra direction cards sit just outside the frame bounds. **5 directions is correct**; don't "fix" the code down to 3 to match the visible frame.

**Repo:** ✅ shipped (D1, signed off 2026-06-01). Async RSC at `app/page.tsx`, `revalidate=3600`. See [`implementation-notes.md` §3](./implementation-notes.md#3-shipped--pages-d) for the build/review history and [`questions-for-designer.md`](./questions-for-designer.md) for open design questions.

### 2.2 о нас — About (SECTION `1227:4296`, 27 children)

The largest section after `Материалы`. Covers an "About" landing plus 6 sub-pages, each with a mobile variant.

| Sub-page | Desktop frame | Mobile frame |
| --- | --- | --- |
| About index | `about` (`706:70`) | `about-mob` (`1248:4488`) |
| Learn more | `about-learn-more` (`706:1257`) | `about-learn-more-mob` (`1251:4457`) |
| Team — variant 1 | `team-1` (`706:1584`) | `team-1-mob` (`1256:5981`) |
| Team — variant 2 | `team-2` (`708:3736`) | `team-2-mob` (`1258:6333`) |
| Documents | `documents` (`706:3499`) | — |
| Story | `story` (`706:3568`) | `story` (`1261:7163`) |
| Letters of appreciation | `Letters-of-appreciation` (`706:3602`) | — |
| Charter | `charter` (`706:3695`) | `charter-mob` (`1261:6901`) |
| Certificate | `Certificate` (`760:1662`) | `Certificate-mob` (`1261:7220`) |

Plus 9 `Status` workflow badges and 2 `_Carousel Button Base` instances.

**Repo:** ❌ none of these routes exist. Likely future layout: `app/about/page.tsx` (index) with sub-routes for `team`, `documents`, `story`, `charter`, `letters`, `certificate`. Live site has more pages than Figma — see plan §D3.

### 2.3 проекты — Projects (SECTION `1227:4297`, 13 children, ~244 frames deep)

| Sub-page | Frame | Width × height | Has breadcrumbs in header |
| --- | --- | --- | --- |
| Projects index | `projects` (`706:1775`) | 1996 × 1440 | no |
| Article (long-form project article) | `article` (`778:1766`) | 3519 × 1440 | yes |
| Project 1 (iteration 1) | `project-1` (`759:845`) | 3170 × 1440 | yes |
| Project 1 (iteration 2) | `project-1` (`1261:7505`) | 4176 × 360 | yes (mobile-only iteration) |
| Project 2 | `project-2` (`759:1379`) | 2644 × 1440 | yes |
| Project 3 | `project-3` (`759:1117`) | 1907 × 1440 | yes |
| `article-mob` | `1567:11148` | 5804 × 360 | yes (article on mobile) |
| `Frame 33945` | (stub) | — | — |

Plus 5 `Status` badges.

**Notes from the scout.** `projects` index does **not** include a breadcrumbs row in its header — distinct from per-project pages. All project detail pages share a common Frame 33938/33934/33787 pattern: a 3-card grid of "project items" (`Frame 251`/`33788`/`33789` with `Frame 151` content inside) followed by tabs (`Frame 33787`, ~572×198) and a text content block (`Frame 33937/33936/33935`).

**Repo:** ✅ index only — `app/projects/page.tsx` (2026-08-15): H1 «ПРОГРАММЫ» + a programme grid with no heading of its own + a «Проекты» grid, over `shared/config/programSections`, no breadcrumbs. **The pages the cards point at are built, but not from these mocks** — `/healthy-russia|kids|youth/` render their existing WordPress content natively at their existing URLs (D6b in the notes), which is what the section's "detail pages" actually are. The Figma `project-1/2/3` templates remain unbuilt and may stay that way; see plan §D6.

### 2.4 видео — Video (SECTION `1227:4298`, 9 children, ~408 frames deep)

| Sub-page | Desktop frame | Mobile frame |
| --- | --- | --- |
| Video index | `video` (`706:3315`, 2940×1440) | — |
| Video filter / catalog view | `video-filter` (`1554:17574`, 2968×1440) | — |
| Video page (player) | `video-page` (`1566:10433`, 3072×1440) | `video-page-mob` (`1567:10735`, `1567:11844`) |
| "Скачать фильм" (download film modal/page) | (`1581:10334`) | — · **not built as a separate surface** — the fidelity pass folded downloads into the player page's hero card as pills, which is what the `video-page` mock itself shows |

Plus 3 `Status` badges.

**Notes from the scout.** Card pattern repeats across the catalog: `Frame 21/26/27/29/30` rows (each 309×1242) each containing a `Frame 8` thumbnail (249×532) + tags row (`Frame 33957` 40×282) + share-block (`Frame 33958` 101×218, with `Frame 36` 64×218 and `Frame 33967` 68×204 vk / youtube / rutube icons). Each video card has its **own** social-share row — three icons (vk, logo-youtube, rutube), 30/30 in small chips at 22.4×22.4 inner size. `video-filter` adds a `Dropdown Menu` (`With Label/Dropdown Content` 40×426) above the card grid; the catalog views show 5 cards visible. The newsletter signup (`Frame 33837`, same as home §8) appears at the bottom of both `video` and `video-filter`.

**Repo:** ✅ both surfaces shipped. Index (D7, 2026-06-04) — `app/video/page.tsx` + `src/modules/Video/` (`VideoCard`, `VideoFilter`) + `fetchVideoList`, reading the `group_film_meta` ACF fields. Desktop = C6 `Dropdown`, mobile = C5 `Tabs`. Cards render downloads / share / watch only when the field is set (graceful degrade). The catalogue is scoped to the **99** films in the four «Видео» sub-categories, not all 203 `format=video` posts. **Player page shipped 2026-07-02** — `FilmPlayer` (Kinescope embed via `kinescope_id`, now populated for **70 of 99** films) + `FilmActions` + `FilmPosterCard` + `CollapsibleBody` + `RelatedFilms`, all under `src/modules/Video/FilmPage/`. **Figma fidelity pass done 2026-07-02** vs `video-page` (`1566:10433`) + `video-page-mob` (`1567:10735`): breadcrumbs-only header, white hero card (player + share/download strip), two-column body with the плакат card extracted from legacy content (`extractFilmPoster`), 22px body behind a «Развернуть» clamp, «Рекомендуем к посмотру» cards, newsletter dropped. **Since A8 (2026-08-13) the player answers at `/<id>`, not `/video/<id>`** — the latter 404s, since it was only ever our own pre-launch shape. The catalogue's four categories became real pages in the same pass (`/video/filmy|multy|roliki|famous-people/`, `app/video/[segment]/` over the shared `modules/Video/VideoCatalogue`), replacing the `?category=` filter. See [`implementation-notes.md` §3–4](./implementation-notes.md#3-shipped--pages-d).

### 2.5 контакты — Contacts (SECTION `1227:4299`, 4 children, ~80 frames deep)

| Sub-page | Frame |
| --- | --- |
| Contact (index) | `contact` (`754:587`, 2649×1440, no breadcrumbs) |
| Contact page (form / structured) | `contact-page` (`754:675`, 1963×1440, with breadcrumbs + Frame 118 page-header banner) |

Plus 2 `Status` badges.

**Notes from the scout.** `contact` index uses an **Accordion** pattern: `Frame 33976` (367-tall, expanded) at the top with an `Add Circle` 28×28 expand icon (`Frame 33979`), followed by 7 collapsed accordion items (`Frame 33978/79/80/81/82/83/84`, each 48×1241). Each expanded item shows name + role rows (`Frame 33883` → `Frame 218` heading 50×280 + `Frame 33981` 56×280 with `Frame 219` / `Frame 217` row pair). `contact-page` adds a "Наши социальные сети" 3-card grid (`Frame 33833` / `Frame 33834`) using the same `Frame 33827/28/29` card pattern shared with home §7 and news index.

**Repo:** ❌ none. Smallest section. Likely a single `app/contacts/page.tsx` (or two: index + form page).

### 2.6 новости — News (SECTION `1227:4300`, 11 children, ~301 frames deep)

| Sub-page | Frame |
| --- | --- |
| News index | `news` (`753:418`, 3064×1440) |
| Article — images variant | `article-images` (`751:148`, 2070×1440 and `1847:10739`, 3525×1440) |
| Article — video variant | `article-video` (`778:1882`, 3450×1440) |
| Video page mobile | `video-page-mob` (`1847:11706`, 4299×360 and `1852:12164`, 4273×360) |
| "Скачать фильм" download CTA | (`1581:10269`) |
| `Frame 34004` | (stub) |

Plus 3 `Status` badges.

**Notes from the scout.** `news` index uses 6 rows × 3 cards (`Frame 33834/35/36/38/39`, each 328×1240 holding three `Frame 33827/28/29` cards 387×328 with `Frame 170/171/172` 90-tall title overlay). The same card primitive lives in home §7 and the contacts socials grid — there is a **single News Card** to extract. News index header includes a search/filter row (`Frame 121` 50×1440 with `Frame 33786` 296×50 filter chip), then `Frame 33788` pagination (36×342) below the grid, then newsletter signup (`Frame 33837`). Article pages have a 387-wide sidebar (`Frame 34005`) with related-article list `Frame 161/165/166/167` (each 67×347) and an embedded newsletter Input + Checkbox.

**Repo:** ⚠️ partial.
- ✅ The article detail is built — `src/modules/News/NewsArticle/`, rendered at the bare `/<id>` by `app/[...slug]/page.tsx` (A8; it used to be `app/news/[id]/page.tsx`). Uses `parsePost` to lift the first carousel/gallery out of the WP post HTML as a header slot (see `src/modules/News/utils/parsePost.tsx`), and `resolveContentImages` to repoint body images at the media CDN. The two "images" and "video" article variants both serve from here depending on WP content.
- ✅ `app/news/page.tsx` (news index `753:418`) shipped 2026-06-03 — breadcrumbs + `НОВОСТИ` heading + `Все / Наши дела / Статьи` filter chips (`?category=`) + 3-col `NewsCard` grid (15/page) + `Pagination` (`?page=`, real `X-WP-TotalPages`) + `NewsletterSignup`. Data via `fetchNewsList`; the grid is shared with `/materials/articles/` as `modules/News/NewsGrid`. See [`implementation-notes.md` §3](./implementation-notes.md#3-shipped--pages-d).
- ✅ `app/materials/articles/page.tsx` — the «Статьи» chip's collection also answers at its **legacy** URL, `/materials/articles/` (114 entries/91 days), which is the canonical of the pair. Not a mock in this section and not a D8 build — see [`implementation-notes.md` §3](./implementation-notes.md#3-shipped--pages-d).
- ✅ The "Скачать фильм" CTA (`1581:10269`) — **resolved without a dedicated flow.** The D7 fidelity pass put downloads inline as pills in the film page's hero card, so there's no modal and no separate route to build. Same conclusion as the видео section's `1581:10334` frame.

### 2.7 Ответы на частые вопросы — FAQ (SECTION `1227:4301`, 2 children, ~34 frames deep)

| Sub-page | Frame |
| --- | --- |
| FAQ | `FAQs` (`1569:13336`, 2649×1440) |

Plus 1 `Status` badge. Simplest section.

**Notes from the scout.** FAQ is a single long accordion. Same primitives as the contacts index (`Add Circle` 28×28 expand icon, `Frame 33976`/77 stack pattern), but here the items are Q&A pairs not contact cards: ~13 accordion items (`Frame 33985`/86/87/88/89/90/91/92/93/94/95/96/97), alternating 48 (collapsed) and 70 (expanded headers) heights, first item fully expanded showing `Frame 33980` (291×979) → `Frame 33927` (291×939) → `Frame 33978` (275×887) answer body.

**Repo:** ❌ no route, but the `Accordion` shared component exists (`src/shared/ui/components/Accordion/`) and is the obvious primitive. Likely a near-trivial `app/faq/page.tsx` once content is wired.

### 2.8 Материалы — Materials (SECTION `1227:4302`, 22 children) — by far the largest

A media-asset catalog. Many sub-frames have dozens of children each — these are grids of downloadable assets. (The scout couldn't pull the full inventory in one round — Figma node too large — but spot-searches confirmed the page templates below.)

| Sub-page | Frame | Asset volume notes |
| --- | --- | --- |
| Article (materials landing) | `article` (`1012:10934`) | 16 children |
| Article content (reader view) | `article-content` (`966:8461`) | 9 children |
| Materials index | `ads` (`778:2206`) | 2 children — ✅ shipped as `app/materials/page.tsx` |
| Handbooks | `handbooks` (`779:4133`) | 1749 × 1440 — ✅ shipped 2026-08-17 as `/materials/metodichki/`, with **no route**: CSS + a content script. No mobile variant exists (checked all 589 frames in the section — nothing under 1440 wide) |
| Books | `books` (`966:6650`) | 3108 × 1440 |
| Disks (DVDs/CDs) | `disks` (`966:8062`) | small |
| Printing | `printing` (`966:2949`) | small |
| Flyers | `flyers` (`966:7747`) | 11 children |
| Social ads | `social-ads` (`966:8538`) | 1676 × 1440 |
| Social posters | `social-posters` (`998:9524`) | 5643 × 1440 (largest — ~88 asset cells) |
| Social stickers | `social-sticker` (`1013:11191`) | 2801 × 1440 |
| Social banners | `social-banners` (`1009:10590`) | 3215 × 1440 |
| Social videos | `social-video` (`1012:11084`) | 2255 × 1440 |
| Social audio | `social-audio` (`1009:10756`) | 2067 × 1440 |
| Car sticker | `car sticker` (`966:8388`) | 65 children |

Plus 7 `Status` badges.

**Repo:** ✅ the index (`app/materials/page.tsx`, 2026-08-15 — the `ads` frame, four static group cards) and `app/materials/articles/`; ❌ the rest. This section has the largest design surface and likely the heaviest CMS / media integration. Component prerequisites are now all built (`Pagination` ✅ C4, `Carousel` ✅ C8, `Tabs` ✅ C5 — for switching between material types); what remains blocking is the CMS taxonomy (no `material` CPT exists) and the asset-hosting capacity plan (Workstream E1).

> **Don't read the size of this section as permission to defer it.** Real traffic puts Materials **#3 by search entries**, and `/materials/plakati/` is the #6 entry page on the whole site. **4 of the 14 sub-pages carry 62 % of the section's entries** (plakati · zakladki · articles · metodichki), so the index plus those four are **Tier 2 — before prod**; the other ten ride the A6 fallback. The index itself is worth building for a second reason the entry ranking hides: **939 views against 107 entries (8.8×)** — almost nobody arrives there from search, but it is how the section gets browsed. And `/materials/articles/` needed no build at all — **✅ shipped 2026-08-13 as a thin alias route** (`app/materials/articles/page.tsx`) listing category 578, a superset of the legacy page's 14 curated links; its five child pages stay on the fallback. See [`implementation-plan.md` §D8](./implementation-plan.md) and the launch tiering.

---

## 3. Top-level non-section frames

The `design` page has top-level frames outside the 7 sections. Some are canonical (home variants), others are legacy.

### 3.1 Canonical (build target)

| Frame | ID | Notes |
| --- | --- | --- |
| `home` (1440 desktop) | `3614:91040` | See §2.1 — canonical desktop home (re-pasted 2026-05-30; old `889:3761` is parked off-canvas). |
| `home` (900 responsive) | `1622:10641` | See §2.1 — small-desktop. |
| `home-mob` | `1356:15986` | See §2.1 — mobile. |
| `главная` (multi-screen) | `3612:11235` | See §2.1 — exploration of home variants and card states. |

### 3.2 Older home / volunteer iterations (legacy — ignore unless Design re-flags)

| Frame | ID | Notes |
| --- | --- | --- |
| `Главная` | `168:718` | Earliest home draft |
| `Главная` | `203:2` | Iteration 2 |
| `Главная` | `242:728` | Iteration 3 |
| `Главная` | `320:5` | Iteration 4 |
| `Главная` | `442:2` | Iteration 5 — superseded by the four §2.1 frames |
| `Стань волонтером` | `168:902`, `206:217`, `242:935` | Three iterations of "Become a volunteer". Not represented in any section. Probably superseded by the participation form scratch (§3.4) — confirm with Design before assuming dead. |

### 3.3 Older component library (legacy — superseded by the `👉 UI` page)

These predate the `👉 UI` design system and are still on the `design` canvas as orphan masters:

| Frame | ID | Role | Superseded by |
| --- | --- | --- | --- |
| `Button` (COMPONENT) | `838:1966` | Old button master | `Button` (canonical) `1297:4792` |
| `Button-2`, `Button-hover`, `Button-2-hover` | `838:1979/1973/1983` | Old button states | (same) |
| `header` (COMPONENT) | `838:1821` | Header used by the loose home iterations | `header-v2` `1229:4371` |
| `header-scroll` (COMPONENT) | `838:1848` | Sticky-scroll variant | (same) |
| `header-v2` (legacy FRAME, not component) | `1327:13553` | An earlier header iteration | `header-v2` COMPONENT `1229:4371` |
| `breadcrumbs` (COMPONENT) | `838:2003` | Old breadcrumbs master | `Breadcrumbs` `1321:5894` |
| `H1`, `H2`, `H3`, `Body` (TEXT) | `838:1252/1250/1253/1256` | Inter typography anchors | PT Sans `text/N/*` scale |
| `H1` | `615:5` | Stray text node | — |
| `Group 2` (COMPONENT_SET) | `921:4773` | Unknown — glance when needed | — |
| `Group 5242` (COMPONENT) | `863:811` | Unknown | — |
| `Group 17` / `Group 5277` (GROUPS) | `218:30`, `957:2894` | Unknown | — |
| `Frame 121` / `Frame 149` / `Frame 153` | `838:2076`, `926:5666`, `957:2882` | Stubs | — |

### 3.4 Participation form scratch

A WIP draft of a "Прими участие" volunteer signup, currently floating outside any section:

- `1` (`1101:4849`) — frame
- `ФОРМА-ЗАЯВКА НА УЧАСТИЕ` (`1101:4844`)
- `IT-ВОЛОНТЕР` (`1101:4845`), `ИНТЕРНЕТ-ВОЛОНТЕР` (`1101:4846`), `ЛЕКТОР` (`1101:4847`) — role tabs
- Multiple long-form text nodes (`1101:4848`, `1103:5403`, `1103:5404`, `1103:5405`, `218:43`) — copy blocks describing the volunteer program

This is likely the body of a future `/participation` or `/volunteer` route. Plausibly the natural home for the §3.2 `Стань волонтером` iterations once Design consolidates them.

### 3.5 Other loose nodes

- `Russian_subdivisions_GRP_per_capita 1` (`442:288`) — embedded chart (Wikipedia map of Russian regional GDP per capita), probably reference art for an infographic, not a UI element
- `Итерация 2` (`442:424`) — text label marking an iteration

---

## 4. Cross-cutting status

### 4.1 Routes that exist vs. designs that exist

Repo side verified 2026-08-13.

| Designed | Built |
| --- | --- |
| ~30+ distinct page mocks across 7 sections + home, most with mobile variants | **7 content routes + 3 ops routes**: `app/page.tsx` (home, D1) · `app/news/page.tsx` (news index, D2) · `app/materials/page.tsx` (the section index, D8) · `app/materials/articles/page.tsx` (a thin category alias, not a D8 build) · `app/video/page.tsx` + `app/video/[segment]/page.tsx` (film catalogue and its four categories, D7) · `app/[...slug]/page.tsx` (post detail — dispatches to the news article or the film page) · `app/sitemap.ts` · `app/robots.ts` · `app/health/route.ts` (container probe) |

**Note the detail-route shape (A8).** There is no `app/news/[id]/` or `app/video/[id]/` any more: post detail is served at the **bare `/<id>`** — the URL the live site uses and 46 % of entries land on — by the catch-all, which picks the news or film body by `post_format`. The two bodies live in `src/modules/News/NewsArticle/` and `src/modules/Video/FilmPage/`. `/news/<id>` and `/video/<id>` **404** — they were this project's own first cut, never public, so they carry no redirect. That same catch-all is where the A6 legacy fallback will render un-redesigned pages, so the route count above will stop tracking "how much of the design is built".

Against the mocks: home, the news index, the news article, the film catalogue and the film player are wired. Everything else in §2 is still a Figma-only proposal.

### 4.2 Mobile variants

Every section that ships will need a mobile variant. Figma has explicit `-mob` frames for:

**With mobile mocks:** home, about, about-learn-more, team-1, team-2, charter, story, Certificate, article (projects), video-page (×2), article-images, video-page (news ×2)

**Without explicit mobile mocks:** contacts, FAQ, materials sub-pages, projects-1/2/3 (only project-1 has a mobile variant), video / video-filter index pages

Probably means responsive-only (single design that adapts) for the latter set, but worth confirming with Design.

### 4.3 Component dependencies

Components that block specific mocks (all spec'd in Figma — see [`design-system.md` §3](./design-system.md#3-component-inventory)). ✅ rows shipped between 2026-05-30 and 2026-06-04 with D1 / D2 / C3–C6; only the header and footer swaps and the Accordion variant are still outstanding:

| Component | Blocks | Status |
| --- | --- | --- |
| `Pagination` (Figma `Pagination Web` `1326:2018`) | `news` index, all `Материалы/social-*` listings | ✅ D2 — `src/shared/ui/components/Pagination/` (40×40/r8; reconcile to 36×36/r6 spec — see plan C4) |
| `Tabs` (Figma `_Button Groups Base (tabs)` `1321:5108`) | `Материалы` (tabs between material types), participation form (role switcher), `PageHeader`'s own tabs row, project-detail tab strip (`Frame 33787`) | ✅ C5 — `src/shared/ui/components/Tabs/` (link-based, large/small, active=`--red-8`; interactive client variant for the participation form still TODO — see plan C5) |
| `Dropdown` (Figma `Dropdown Menu` `1324:4234`) | `video-filter` (top-of-page filter) | ✅ C6 — `src/shared/ui/components/Dropdown/` (single-select on Radix Themes Select; multi-select+chips variant deferred) |
| `Checkbox` (Figma `Checkbox` `1323:257`) | `video-filter`, contact form, participation form, every newsletter signup (home §8 etc.) | ✅ D1 — `src/shared/ui/components/Checkbox/` |
| Standalone `Carousel` | **Home §3 / §5 / §6** (three carousels), several about/project pages. Figma supplies only the chrome (`_Carousel Button Base` + `_Carousel Page Indicator Base/Small/Dot`); the slider container is up to us (Swiper is already a dep). | ✅ D1 — `src/shared/ui/components/Carousel/` |
| `PageHeader` (composition, not a hero) | Every non-news non-index page (project-1/2/3, article, video-page, contact-page, FAQ, all about sub-pages). Composes header-v2 + breadcrumbs + heading + optional tabs row — see [`design-system.md` §3.2](./design-system.md#32-components-defined-on-the--ui-page). | ✅ C3 — `src/shared/ui/components/PageHeader/` (breadcrumbs + red uppercase H1 + optional `tabs` slot; header-v2 is the global layout Header, not re-rendered; `/news` refactored onto it) |
| `Button` wrapper | Everywhere — currently Radix `<Button>` inline. Figma matrix: 27 cells (3 Variant × 3 Size × 3 State). | ✅ D1 — `src/shared/ui/components/Button/` |
| `IconButton` wrapper | Header-mob search/menu, carousel controls. Figma matrix: 12 cells (2 Radius × 2 Variant × 3 State). | ✅ D1 — `src/shared/ui/components/IconButton/` |
| Header swap (header-v2 + header-mob) | Live `modules/Header` is on older `header` / `header-scroll`. The new components include a styled search Input — see plan B7. | ❌ missing |
| Footer swap (footer + footer-mob) | Live `modules/Footer` is on older masters. | ❌ missing |
| News Card (extract from home §7 / news index / contacts socials grid) | Home, news index, contacts. Card is `Frame 33827/28/29(/30)` (387×328 desktop) with `Frame 170/171/172(/173)` title overlay — same primitive in three places. | ✅ D1 — `src/shared/ui/components/NewsCard/` (reused by D2) |
| Accordion item with `Add Circle` expand icon | FAQ, contacts index — `Frame 33976/77/78/85-97` use the same expand/collapse pattern. The repo already has a Radix-based `Accordion`; spec just needs aligning. | ⚠️ `Accordion` exists; needs `Add Circle` variant |
| Newsletter signup block | Home §8, every catalog page (`Frame 33837`). Re-uses `Input Field` + `Button` + `Checkbox` primitives — likely a `<NewsletterSignup>` shared module. | ✅ D1 — `src/modules/NewsletterSignup/` (reused by D2) |

### 4.4 Build order — dependency vs. shipping

This section is a **dependency** order: what must exist before what *can* be built. It is **not** the shipping order — that is decided by measured traffic in [`implementation-plan.md` → Launch priority](./implementation-plan.md#launch-priority), and **where the two disagree, traffic wins.** The two known disagreements: **Materials** is last here but Tier 2 there (partially, 4 sub-pages), and **FAQ** is step 5 here but Tier 4 there (70 views in 91 days — it stays on the fallback indefinitely).

1. ✅ **Home** (frames in §2.1) + **PageHeader** + **Button** + **Carousel** chrome + **Checkbox** — done 2026-05-30…06-01. As predicted, the home composition pulled nearly every primitive into shape.
2. ✅ **News index** (`новости/news` `753:418`) + **Pagination** — done 2026-06-03, reusing the News Card extracted in step 1.
3. ✅ **Video** (`video` + `video-filter` + `video-page`) — done 2026-06-04 / 07-02, and it delivered **Dropdown** and **Tabs** along the way. It jumped the queue because it is 44 % of all site traffic.
4. **Materials** index + `plakati` / `zakladki` / `metodichki` — **next by traffic**, blocked on the CMS taxonomy decision, not on components.
5. **Contacts** (`контакты/contact-page`) + the Accordion `Add Circle` variant — the *directory* has no form on the live site, so it does **not** depend on B6; defer the form.
6. **`/profile/[slug]`** detail template — more search traffic than `/team/` and all of `/about/*` combined, and the CPT is already Gutenberg.
7. **About** landing + sub-pages — biggest sub-tree, mostly composition of existing primitives now that PageHeader exists.
8. **Projects** + per-project pages — confirm with Design that `project-1/2/3` correspond to anything real first; there is no project-detail traffic at all.
9. **FAQ** — cheap once content is wired, but nothing is waiting on it.

---

## 5. Quick reference — node IDs for jumping into Figma

Paste after `?node-id=` in the Figma URL.

**Sections**
- о нас — `1227:4296`
- проекты — `1227:4297`
- видео — `1227:4298`
- контакты — `1227:4299`
- новости — `1227:4300`
- Ответы на частые вопросы (FAQ) — `1227:4301`
- Материалы — `1227:4302`

**Home (top-level, no SECTION)**
- `home` 1440 — `3614:91040` (re-pasted 2026-05-30; old `889:3761` parked off-canvas)
- `home` 900 — `1622:10641`
- `home-mob` — `1356:15986`
- `главная` (multi-screen exploration) — `3612:11235`

**Loose canonical-ish frames**
- Participation form scratch — `1101:4849` and surrounding `1101:*` text nodes
