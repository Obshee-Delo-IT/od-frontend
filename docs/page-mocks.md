# Page mocks — Figma ↔ Repo

This is the companion to [`design-system.md`](./design-system.md). That file maps the `👉 UI` page (the design system). **This file maps the `design` page** — the page mocks that consume the design system — and tracks which mocks have been built as Next.js routes.

Last verified against Figma: 2026-05-29.

---

## 1. How the `design` page is organized

The `design` page (id `168:717`) is the only canvas in this Figma file other than `👉 UI`. It holds **48 top-level children** in two layers:

1. **8 `SECTION` containers**, one per site section. These are the canonical home for page mocks — anything that ships should live inside a section.
2. **~40 loose top-level frames**, mostly older exploration / iterations that predate the section organization. Treat as legacy unless explicitly referenced.

`SECTION` nodes also contain `Status` instances — green "done" pills from a Figma template (Inter, white-on-green). These are **workflow annotations, not UI**: ignore them when building.

Throughout this doc, frame names ending in `-mob` are mobile variants of the desktop frame with the same base name.

---

## 2. Sections — design ↔ repo route map

Status legend: ✅ implemented, ⚠️ partial, ❌ not built.

### 2.1 главная — Home (`1227:4303`, 20 children)

| Frame | ID | Variant | Notes |
| --- | --- | --- | --- |
| `home` | `889:3761` | desktop, iteration 1 | 6 children — older draft |
| `home` | `1622:10641` | desktop, iteration 2 (latest) | **19 children — current target** |
| `home-mob` | `1356:15986` | mobile | 3 children |
| `Frame 33821`, `Frame 33822` | `1350:9023`, `1350:9196` | — | Two-child stub frames; likely component slots being designed |
| 8× `Rectangle 18x` / `19x` | — | — | Placeholder rectangles outside any frame — design scratch |
| 2× `_Carousel Button Base` instances | — | — | Stand-alone carousel control instances |

**Repo:** ❌ no `app/page.tsx`. The root URL has no handler. Highest-priority gap given that the home is the entry point for every other section.

### 2.2 о нас — About (`1227:4296`, 27 children)

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

**Repo:** ❌ none of these routes exist. Likely future layout: `app/about/page.tsx` (index) with sub-routes for `team`, `documents`, `story`, `charter`, `letters`, `certificate`.

### 2.3 проекты — Projects (`1227:4297`, 13 children)

| Sub-page | Desktop frame | Mobile frame |
| --- | --- | --- |
| Projects index | `projects` (`706:1775`) | — |
| Article (project article) | `article` (`778:1766`) | `article-mob` (`1567:11148`) |
| Project 1 (iteration 1) | `project-1` (`759:845`) | — |
| Project 1 (iteration 2) | `project-1` (`1261:7505`) | — |
| Project 2 | `project-2` (`759:1379`) | — |
| Project 3 | `project-3` (`759:1117`) | — |
| `Frame 33945` | (stub) | — |

Plus 5 `Status` badges.

**Repo:** ❌ none. Likely `app/projects/page.tsx` + `app/projects/[slug]/page.tsx` (or per-project hard-coded routes — TBD).

### 2.4 видео — Video (`1227:4298`, 9 children)

| Sub-page | Desktop frame | Mobile frame |
| --- | --- | --- |
| Video index | `video` (`706:3315`) | — |
| Video filter / catalog view | `video-filter` (`1554:17574`) | — |
| Video page (player) | `video-page` (`1566:10433`) | `video-page-mob` (`1567:10735`, `1567:11844`) |
| "Скачать фильм" (download film modal/page) | (`1581:10334`) | — |

Plus 3 `Status` badges.

**Repo:** ❌ none. Filter UI in `video-filter` is the source for the unbuilt `dropdown` / `checkbox` / `pagination` components flagged in [`design-system.md` §3](./design-system.md#3-component-inventory).

### 2.5 контакты — Contacts (`1227:4299`, 4 children)

| Sub-page | Frame |
| --- | --- |
| Contact (index) | `contact` (`754:587`) |
| Contact page (form?) | `contact-page` (`754:675`) |

Plus 2 `Status` badges.

**Repo:** ❌ none. Smallest section — likely a single `app/contacts/page.tsx`.

### 2.6 новости — News (`1227:4300`, 11 children)

| Sub-page | Frame |
| --- | --- |
| News index | `news` (`753:418`) |
| Article — images variant | `article-images` (`751:148`, `1847:10739`) |
| Article — video variant | `article-video` (`778:1882`) |
| Video page mobile | `video-page-mob` (`1847:11706`, `1852:12164`) |
| "Скачать фильм" | (`1581:10269`) |
| `Frame 34004` | (stub) |

Plus 3 `Status` badges.

**Repo:** ⚠️ partial.
- ✅ `app/news/[id]/page.tsx` exists — handles the article variants. Currently uses `parsePost` to extract the first carousel/gallery from WP post HTML as a header (see `src/modules/News/utils/parsePost.tsx`). Both "images" and "video" variants in Figma probably both serve from this route depending on WP content.
- ❌ `app/news/page.tsx` (news index `753:418`) is **not built**. Without it, there's no listing page; users can only reach an article via direct URL or external link.
- ❌ The "Скачать фильм" download flow is not built either.

### 2.7 Ответы на частые вопросы — FAQ (`1227:4301`, 2 children)

| Sub-page | Frame |
| --- | --- |
| FAQ | `FAQs` (`1569:13336`) |

Plus 1 `Status` badge. Simplest section.

**Repo:** ❌ no route, but the `Accordion` shared component exists (`src/shared/ui/components/Accordion/`) and is the obvious primitive. Likely a near-trivial `app/faq/page.tsx` once content is wired.

### 2.8 Материалы — Materials (`1227:4302`, 22 children) **— by far the largest**

A media-asset catalog. Many sub-frames have dozens of children each — these are likely grids of downloadable assets.

| Sub-page | Frame | Child count (asset volume) |
| --- | --- | --- |
| Article (materials landing?) | `article` (`1012:10934`) | 16 |
| Article content (reader view) | `article-content` (`966:8461`) | 9 |
| Ads | `ads` (`778:2206`) | 2 |
| Handbooks | `handbooks` (`779:4133`) | 7 |
| Books | `books` (`966:6650`) | 5 |
| Disks (DVDs/CDs) | `disks` (`966:8062`) | 3 |
| Printing | `printing` (`966:2949`) | 3 |
| Flyers | `flyers` (`966:7747`) | 11 |
| Social ads | `social-ads` (`966:8538`) | **22** |
| Social posters | `social-posters` (`998:9524`) | **88** |
| Social stickers | `social-sticker` (`1013:11191`) | **23** |
| Social banners | `social-banners` (`1009:10590`) | **26** |
| Social videos | `social-video` (`1012:11084`) | **17** |
| Social audio | `social-audio` (`1009:10756`) | **18** |
| Car sticker | `car sticker` (`966:8388`) | **65** |

Plus 7 `Status` badges.

**Repo:** ❌ none. This section has the largest design surface and likely the heaviest CMS / media integration. Unbuilt components blocking it: `pagination`, `Carousel` (standalone), `Tabs` (probably for switching between material types).

---

## 3. Loose top-level frames on the `design` page (legacy / scratch)

These live **outside** the 8 sections and predate the section organization. Most are early iterations or design exploration; treat as **non-canonical** unless something inside is still referenced.

### 3.1 Older home / volunteer iterations

| Frame | ID | Notes |
| --- | --- | --- |
| `Главная` | `168:718` | Earliest home draft |
| `Главная` | `203:2` | Iteration 2 |
| `Главная` | `242:728` | Iteration 3 |
| `Главная` | `320:5` | Iteration 4 |
| `Главная` | `442:2` | Iteration 5 (latest of the loose ones) — but the canonical home now lives inside the `главная` section (`1622:10641`) |
| `Стань волонтером` | `168:902`, `206:217`, `242:935` | Three iterations of the "Become a volunteer" page. **Not represented in any section** — probably superseded by the participation form scratch (see §3.3). Worth confirming with Design before assuming dead. |

### 3.2 Component references and typography anchors

These predate the `👉 UI` page and look like the previous iteration of the design system, now superseded:

| Frame | ID | Role |
| --- | --- | --- |
| `Button` (COMPONENT) | `838:1966` | Old button master |
| `Button-2`, `Button-hover`, `Button-2-hover` | `838:1979`, `838:1973`, `838:1983` | Old button states |
| `header` (COMPONENT) | `838:1821` | Header used by the loose home iterations |
| `header-scroll` (COMPONENT) | `838:1848` | Sticky-scroll variant of the same |
| `header-v2` (FRAME) | `1327:13553` | A newer header iteration — still a frame, not yet a component. Likely the target replacement for `header` / `header-scroll`. **Worth comparing to the live `modules/Header` implementation.** |
| `breadcrumbs` (COMPONENT) | `838:2003` | Old breadcrumbs master |
| `H1`, `H2`, `H3`, `Body` (TEXT) | `838:1252`, `838:1250`, `838:1253`, `838:1256` | Inter typography anchors — superseded by the PT Sans `text/N/*` scale on the `👉 UI` page |
| `H1` | `615:5` | Stray text node |
| `Group 2` (COMPONENT_SET) | `921:4773` | Unknown — worth a glance |
| `Group 5242` (COMPONENT) | `863:811` | Unknown |
| `Group 17` (GROUP), `Group 5277` (GROUP) | `218:30`, `957:2894` | Unknown groups |
| `Frame 121`, `Frame 149`, `Frame 153` | `838:2076`, `926:5666`, `957:2882` | Stubs / scratch |

### 3.3 Participation form scratch

A WIP draft of a "Прими участие" volunteer signup, currently floating outside sections:

- `1` (`1101:4849`) — frame
- `ФОРМА-ЗАЯВКА НА УЧАСТИЕ` (`1101:4844`)
- `IT-ВОЛОНТЕР` (`1101:4845`), `ИНТЕРНЕТ-ВОЛОНТЕР` (`1101:4846`), `ЛЕКТОР` (`1101:4847`) — role tabs
- Multiple long-form text nodes (`1101:4848`, `1103:5403`, `1103:5404`, `1103:5405`, `218:43`) — copy blocks describing the volunteer program

This looks like the body of a future `/participation` or `/volunteer` route that hasn't been finalized — possibly the natural home for the three loose `Стань волонтером` iterations once consolidated.

### 3.4 Other loose nodes

- `Russian_subdivisions_GRP_per_capita 1` (`442:288`) — embedded chart (Wikipedia map of Russian regional GDP per capita), probably reference art for an infographic, not a UI element
- `Итерация 2` (`442:424`) — text label marking an iteration

---

## 4. Cross-cutting status

### 4.1 Routes that exist vs. designs that exist

| Designed | Built |
| --- | --- |
| ~30+ distinct page mocks across 8 sections, most with mobile variants | **1 route**: `app/news/[id]/page.tsx` |

The repo is at the very start of build-out — only the news article detail is wired. Everything else in §2 is still a Figma-only proposal.

### 4.2 Mobile variants

Every section that ships will need a mobile variant. Figma has `-mob` frames for **home, about, about-learn-more, team-1, team-2, charter, story, Certificate, article (projects), video-page, article-images, video-page (news)**. Sections lacking explicit mobile mocks: contacts, FAQ, materials sub-pages, projects-1/2/3, video / video-filter. Probably means responsive-only (single design that adapts) for those, but worth confirming with Design.

### 4.3 Component dependencies

Components missing from the repo that block specific mocks:

| Missing component (see [`design-system.md` §3](./design-system.md#3-component-inventory)) | Blocks |
| --- | --- |
| `Pagination` | `news` index, all `Материалы/social-*` listings |
| `Tabs` | `Материалы` (likely tabs between material types), participation form (role switcher) |
| `Dropdown` | `video-filter` |
| `Checkbox` | `video-filter`, contact form, participation form |
| `Carousel` (standalone, not WP-block) | Home iterations, several about/project pages |
| `PageHeader` (hero) | Every non-news page |
| `Button` wrapper | Everywhere — currently Radix `<Button>` inline |
| `IconButton` wrapper | Header search, carousel controls |

### 4.4 Suggested build order

If shipping incrementally, the dependency chain points to:

1. **Home** (`главная`, frame `1622:10641`) + **PageHeader** + **Button** wrapper — unblocks the canonical entry point and the most-reused chrome.
2. **News index** (`новости/news` `753:418`) + **Pagination** — completes the news flow that's currently dangling.
3. **About** landing + sub-pages — biggest sub-tree, lots of content but mostly composition of existing primitives once PageHeader exists.
4. **Contacts** (`контакты/contact-page`) + **Checkbox** — small and unblocks the contact form.
5. **FAQ** + use of existing `Accordion`.
6. **Projects** + per-project pages.
7. **Video** (incl. `video-filter` → also delivers `Dropdown` + remaining `Checkbox` patterns).
8. **Materials** — by far the largest, lots of CMS work; build last once the asset-listing pattern is settled.

---

## 5. Quick reference — node IDs for jumping into Figma

Paste after `?node-id=` in the Figma URL.

**Sections**
- главная — `1227:4303` (home `1622:10641`, home-mob `1356:15986`)
- о нас — `1227:4296`
- проекты — `1227:4297`
- видео — `1227:4298`
- контакты — `1227:4299`
- новости — `1227:4300`
- FAQ — `1227:4301`
- Материалы — `1227:4302`

**Loose canonical-ish frames**
- header-v2 (frame) — `1327:13553`
- Participation form scratch — `1101:4849` and surrounding `1101:*` text nodes
