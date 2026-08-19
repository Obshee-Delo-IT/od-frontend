# Implementation plan

**What's left.** Everything already shipped — with its rationale, measurements and superseded decisions — lives in [`implementation-notes.md`](./implementation-notes.md). This file is deliberately short: if an item closes, it moves there.

Status legend: `[ ]` not started · `[~]` partial or blocked · `[x]` done.

---

## Current state (2026-08-13)

**Shipped routes:** `/` · `/news/` · `/materials/articles/` · `/video/` + `/video/<segment>/` (4 categories) · `/<id>` (post detail — news or film, by `post_format`) · `/sitemap.xml` · `/robots.txt` · `/health/` · `POST /api/revalidate/`.

**Shipped, in one line each** — detail in [`implementation-notes.md`](./implementation-notes.md):

| | what |
|---|---|
| **A2** | Hosting decided: Beget VPS + Coolify, images built in GH Actions → GHCR. `/health` + `.dockerignore` fixed. |
| **A3** | CI runs lint · type-check · test · build on every PR and on `main`, without WP secrets. |
| **A8** | URL compatibility — 59 % of entries. `/<id>` and `/video/<segment>/` served; the whole `/category/*` family, `/video/short/` and every `/page/N/` at one 301 each. |
| **C1–C11** | Button · IconButton · PageHeader · Pagination · Tabs · Dropdown · Checkbox · Carousel, then header-v2 + header-mob + footer + footer-mob · Modal on Radix Dialog · the `Links` colour matrix. **Workstream C is closed.** |
| **D1** | Home, desktop + mobile, nine sections. |
| **D2** | News index + post detail. |
| **D7** | Film catalogue + film page (Kinescope player, downloads, poster card, related films). |
| **B-VIDEO** | ACF `group_film_meta`, 18 fields, canonical film data model + the `film:*` CSV tooling. |
| **B2 · B3 · B7 · B-CPT** | Data layer: type generation unblocked · cache tags on every WP request · `fetchSearch` · the `profile`/`project` recon behind D3. |
| **E3/E4** | Downloads ride in post content; Kinescope НКО approved and embedded. |
| **F4** | Half: sitemap (8 248 URLs), robots, `metadataBase`, self-referential canonicals. |
| **F6** | Half: prod `/conf_politics/` is correct and cookie consent is live on the legacy site; the footer's СМИ line + 12+ verified as WordPress data. |

**Researched, not built:** the live site's shape and constraints (§6 of the notes) · 91 days of Yandex Metrica traffic (§7) · the WP content model and plugin landscape ([`wp-backend.md`](./wp-backend.md)) · the Figma token and page inventories ([`design-system.md`](./design-system.md), [`page-mocks.md`](./page-mocks.md)).

**Launch blockers:** **A6** (legacy fallback), **B-VIDEO2** (film data — editorial, not code), **A7** ([`prod-migration-runbook.md`](./prod-migration-runbook.md)). Not an unbuilt page.

---

## Launch priority

Measured, not guessed — the derivation is [notes §7](./implementation-notes.md#7-research--traffic-yandex-metrica-91-days). Two numbers drive everything below:

> **Built routes cover 85.1 % of entry visits and 77.2 % of pageviews.** The A6 fallback carries the rest: **13.5 % of entries, 20.0 % of views.**

Rank by **entry visits** first — that's what search sends, and what the iframe degrades. Then re-read by **pageviews**, because under A6 the body is the old design and a heavily-browsed page shows a visible seam. The two rank differently often enough that ignoring the second one gets the order wrong.

**Tier 0 — blocks launch regardless of traffic.** ~~A8~~ ✅ · **A6** (the mechanism everything below Tier 2 depends on) · **B-VIDEO2** (film data) · ~~**F6**'s `/conf_politics/` privacy text + the footer СМИ line and 12+ badge~~ ✅ — both closed 2026-08-13; what remains of F6 is the app's own consent banner (with **A4**) and the per-form checkbox (with **B6**), neither of which blocks a content launch.

**Tier 1 — done.** D1 Home · D2 News · D7 Video. Remaining work on these is data and URLs, not markup.

**Tier 2 — ship natively before prod, in order:**
1. **`plakati` · `zakladki` · ~~`metodichki`~~** (partial D8) — 62 % of the section's entries for ~30 % of the build. `articles` ✅ already done as an alias, and the **`/materials/` index** ✅ shipped 2026-08-15 — it had only 107 entries but 939 views (8.8×), and was built for the second reason; it moved into its own WP page on 2026-08-18 (D6h). **`metodichki` ✅ shipped 2026-08-17** — the first page through the [`wp-page-redesign.md`](./wp-page-redesign.md) flow, so `wp/scripts/od-pages.php` and `PersonCard` now exist for the next two.
2. **`/contacts/`** (D4, directory only — the live page has no form, so B6 is *not* a dependency).
3. **`/profile/[slug]`** (D3 subset — the CPT is already Gutenberg, so this is one template over existing data).

**Tier 3 — fallback at launch, redesign after prod.** `/about/*` · `/get-involved/*` · `/healthy-*` · `/team/` · `/actual/` · the other 10 `/materials/` sub-pages. (`/projects/` was on this list and is now rendered from WordPress — D6's index shipped 2026-08-15 as a native route and moved into the WP page itself on 2026-08-18, D6g.) ~2 800 views, ~1 100 entries. **Order these by views, not entries** — everything here is low-entry by construction, so the question is how many people will *see* an iframe. That puts `/about/` first (1 036 views, the most-viewed page behind the fallback) — `/projects/` (794) came second and has since been built natively — then `/get-involved/` (586); `/team/` (326) and `/actual/` (134) genuinely last.

**Tier 4 — leave on the fallback indefinitely.** `/faq/` (70 views — **D5 drops to last**) · `/sitemap/` · `/sp/` · `/sms/` · `/rekvizit/` · `/my-account/` · `/campaign/` · `/pl-categs/` · WP account/preview URLs. Under 0.5 % of the site combined.

**Do not build, redirect instead** — done in A8's `src/proxy.ts`: the whole `/category/*` family and `/page/N/` home pagination. Still open: the `?s=` search URLs (→ B7).

A redesigned route auto-shadows its fallback, so Tier 3 is reversible page-by-page with no migration step.

---

## Workstream A — Foundations

- [~] **A1b. Foundation drift** — one structural mismatch left between Figma's tokens and the repo. **Blocks nothing but compounds.**
  - ~~**Breakpoints are 4-tier in Figma, 3-tier in code.**~~ ✅ **Done with C9, 2026-08-13** — `media.css` gained `--tablet (width < 1200px)`, *added* rather than renamed so the existing max-width tiers keep nesting. Note the design's two thresholds are not the same one: nav type steps down at 1440, side padding at 1200.
  - **Spacing: multiples of 4 vs 5.** Figma `spacing/*` is `0/5/10/15/20/25/35/45/65/80`; `Box` is `0/4/8/…/64`. Rebase `Box` or accept rounding — either way, document it.
- [~] **A3 remainder.** CI ends at `pnpm build`; the **docker build + push-to-GHCR** step is missing, and the **Dockerfile has no `ARG WP_BASE` / `ARG WP_MEDIA_CDN`** in the `builder` stage, so `--build-arg` currently reaches nothing and `next/image` would 400 on remote images. Both land together.
- [ ] **A4. Observability.** **Yandex Metrica only** (GA is excluded under current Russian regulations, and was removed from prod on 2026-08-07). **Counter id `34478865`** — prod's own, so the new site inherits the history rather than starting a fresh counter. Wire into `app/layout.tsx` behind a 152-FZ consent banner (F6); the legacy site already shows one, so the app must not ship without it. **Error tracking deferred** — rely on standalone-server stdout/stderr until traffic justifies a tool.
- [ ] **A5. Staging environment.** A second deployed instance pointed at od-dev so Design and editors can preview. ⚠️ Must set `SITE_URL` explicitly, or it advertises prod's canonicals.
- [x] **A6. Legacy-page fallback — DONE 2026-08-14.** The ~170 not-yet-redesigned pages are served at their live URLs as an iframe through `app/legacy/[...slug]/route.ts`, inside the layout's shell. It was **not** blocked on the frozen copy after all: `WP_LEGACY_BASE` points at live production and the proxy strips the chrome itself, so the swap to a frozen copy is one env var and no code. Swept over all 172 pages in the legacy sitemap — no page loses a script, keeps its chrome or leaks a link — and `pnpm url:check` went from 83.7 % to **98.8 %** entry-traffic coverage. Specs and decisions in [`openspec/changes/fallback/`](../openspec/changes/fallback/); the 2026-06-08 design record in [`legacy-page-fallback.md`](./legacy-page-fallback.md) carries a status block listing the five things it got wrong. **Remaining leg:** point `WP_LEGACY_BASE` at the frozen copy once it exists — it must not stay on `obshee-delo.ru` after cutover, since this app becomes that host and the fallback would proxy itself (the app warns at boot). **And the copy has to be cloned with the usual domain search-replace**, so its HTML emits its own host: in-content links are rewritten by comparing them against the origin the page was fetched from, so a copy still emitting `obshee-delo.ru` links leaves them un-rewritten — measured, 32 of `/team/`'s 80 anchors are absolute to the current host (the 20 root-relative ones ride the `<base>` and are safe either way). Invisible on prod, where that host is ours by then; on stage it sends visitors to live production, and `pnpm legacy:sweep` will *not* catch it — its link check only asks whether a link is still on the legacy origin.
- [ ] **A7. od-stage → prod migration — Tier 0 blocker.** Procedure in [`prod-migration-runbook.md`](./prod-migration-runbook.md). **Hard blockers in severity order:** REST is disabled on prod and stage (clearfy-pro) so nothing renders at all; prod stores CMSMasters shortcodes where od-dev stores Gutenberg (verified for pages, **unverified for `format=video` posts**); ACF isn't installed there; post ids and possibly category ids differ per environment. Run the whole runbook against od-stage first.

---

## Workstream B — WordPress / data layer

**B2, B3, B4 and B-CPT shipped 2026-08-13**, plus B7's frontend half — type generation unblocked, cache tags on every WP request, `POST /api/revalidate/` with the WordPress mu-plugin that calls it installed on od-dev, `fetchSearch`, and the `profile`/`project` recon behind D3. Detail in [notes §4](./implementation-notes.md#4-shipped--data--media-b-e). Everything below is what's left, and **the two biggest items are not code**: B1's content shape and B-VIDEO2's film data.

- [~] **B1 remainder.** CPT inventory is done ([`wp-backend.md`](./wp-backend.md) §3–4). **Left:** decide the content shape for **materials** (D8) and **FAQ** (D5) — plain pages, a taxonomy on a generic CPT, or widgets. See [`wp-backend.md` §8](./wp-backend.md#8-outstanding-questions-the-wp-state-doesnt-answer). **This is the biggest unanswered content question and it blocks Tier 2.**
- [ ] **B6. Forms backend.** Every form in the redesign is **net-new** — the live site has none. Submissions land in the existing RU-hosted WordPress (152-FZ), via a WP plugin endpoint (CF7 / Gravity / WPForms) or an `app/api/*` proxy. Spam protection: **Yandex SmartCaptcha**, not reCAPTCHA. Email via WP's existing mail config.
- [~] **B7 remainder.** `fetchSearch` shipped ([notes](./implementation-notes.md#b7-search--the-data-layer-2026-08-13)) — endpoint probed, paging and `subtype` filtering work. **Left:** the UI. The input ships with `header-v2` (**C9**), and a results page has no mock yet — two design questions before any of it: what search covers (posts only? pages too?) and what a result looks like, given WP returns no excerpt or thumbnail. Also still open: routing the legacy `?s=` URLs, which need a destination that exists.
- [~] **B8. WP cleanup — kill the page-builder and unsupported UI plugins.** Headless means WP only serves data, so most of the active plugins are dead weight. Target list and ordering in [`wp-backend.md` §4](./wp-backend.md).

  **B8a — `cmsms-content-composer` is gone (od-dev, 2026-08-18).** ✅ Deactivated **and deleted**, the second half being the point: three of its PHP files bootstrap WordPress themselves and answer unauthenticated HTTP whether or not the plugin is active — and **they still do on prod** ([`next-steps.md`](./next-steps.md)). Its registration now lives in `wp/mu-plugins/od-profile.php` (`profile` + `pl-categs` + the `cmsms_profile_subtitle` meta, `init` priority 20, `show_in_rest` added to the taxonomy so `/wp/v2/pl-categs` answers). The four published posts that still held `[cmsms_*]` were converted first, through four new branches in `cmsms-gutenberg-upgrade`, so prod's cutover conversion inherits them. **Unblocks D3**, and `/wp/v2/pl-categs` gives it a region filter it did not have. Detail and the verification list in [`wp-backend.md` §3.1](./wp-backend.md). Left: **the same three steps on prod** — convert the content, install the mu-plugin, then deactivate **and delete** — in that order and no other, since installing the registration after the removal leaves 205 records with no post type. [Runbook §2.6](./prod-migration-runbook.md) carries the commands and the verification list.

  Rest of the critical path:
  1. Build/pick the headless theme (custom 5-file minimal, or stock Twenty Twenty-Five). The CPT registration is **no longer part of this** — it is an mu-plugin precisely so a theme swap cannot take it down.
  2. Migrate or accept loss of `wp-block-cb-carousel-v2` markup in existing posts before removing `carousel-block` (cleanest: bulk-replace with core `wp-block-gallery`, which `parsePost.tsx` already handles).
  3. Deactivate + delete in order: welfare → the remaining cmsms-* → UI/shortcode plugins → optional UX plugins → emergency-only tools. **`ACF` is load-bearing — do not remove it.**
  4. *(optional)* drop dead `cmsms_*` / `nvp_content_copy` postmeta — **excluding `cmsms_profile_subtitle`**, which the mu-plugin re-registers and D3 reads. And the rows the deactivation orphaned: 21 `project` drafts, 41 `content_template`, 1 430 `cmsms_like`.
  5. Replace wysija-newsletters if newsletters are in scope. 6. Decide on leyka. 7. Decide on wp-graphql.

  End state: **~6 active plugins**. Removing clearfy-pro also kills the WP-CLI redirect gotcha and the REST block that is runbook blocker B1.
- [ ] **B-VIDEO2. Finish populating film link data — Tier 0 blocker, but editorial, not code.** The tooling is done and exhausted. **Root cause: not every film post has video links.** The automated match is deterministic only through the YouTube bridge (`share_youtube` → source video title → its Kinescope entry, since the library is a 1-to-1 YouTube import). All **27** films with a `share_youtube` are matched, and **0 of the 29 still missing a `kinescope_id` have one**. Measured on od-dev 2026-08-05, **re-verified unchanged 2026-08-13** — no editorial data has arrived since:

  | field | filled | | field | filled |
  |---|---|---|---|---|
  | `kinescope_id` | **70** | | `poster_download_url` | 16 |
  | `share_vk` / `share_rutube` | 28 / 28 | | `trailer_url` | 12 |
  | `share_youtube` | 27 | | `poster_image_url` | 11 |
  | any download slot | 31 | | featured image | 29 |
  | | | | **`watch_url`** | **0** |

  The 29 without a player: **Известные люди 20**, Видео события 7, Мультфильмы 1, Ролики 1 — mostly short interview clips with generic titles, exactly where title matching fails.

  **What editors must supply, in priority order:** (1) a **YouTube / VK Видео / Rutube link per film** — each converts straight into a `kinescope_id`; (2) `poster_image_url` / `poster_download_url` for the 83–88 films with no плакат; (3) featured images for the 70 without one; (4) `watch_url`, if «Смотреть онлайн» should point somewhere other than the embed.

  **Then re-run, in order** (all idempotent, dry-run by default, an empty cell never clears): `pnpm film:export` → edit → `pnpm film:kinescope` → `pnpm film:import --apply` → `pnpm film:covers --apply`. Caveats in [`prod-migration-runbook.md` §3](./prod-migration-runbook.md).

  **Cases links won't fix:**
  - **28749 «The Mystery of the Deadly Smoke»** — the English cut. Three Russian «Тайна едкого дыма» uploads exist, no English one; someone must upload it.
  - **37626 / 14590 / 32168** duplicate 26122 / 38406 / 38424; likewise the pairs 38420/31445 and 38424/32168. Assigning one Kinescope id twice works, but merging the posts is the real fix. **Duplicate uploads are normal in this library**, so an orphan resembling a matched film is usually a second upload, not a missed match.
  - **67400** has a `status: error` Kinescope upload (`2kgaX4mQMQcxVvn177pfDF`, duration 0) alongside the working one — worth deleting. Its download labels are also wrong: `disk.yandex.ru/i/-5L5AfVOrXQFlw` is stored as «Сокр. версия» but is the 35-минутная полная версия.
  - **39664 «Как научиться любить?» has no `share_youtube`** — the Telegram channel gives it 71933's link. One of the two channel posts is wrong.
  - **8 films exist on prod but not od-dev** and sit in the worksheet with a blank `id` (2 already have a Kinescope id). Fill when the sheet runs against prod.

---

## Workstream C — Design system

**Closed 2026-08-13.** C1–C8 shipped earlier; **C9 · C10 · C11 shipped** — header-v2 + header-mob + footer + footer-mob promoted to the live modules, `Modal` moved onto Radix Dialog, and `Link` aligned to the `Links` matrix. Detail, the three bugs C9 turned up, and a second Figma pass that measured the shipped result node by node and corrected four more, in [notes §2](./implementation-notes.md#2-shipped--design-system-c).

What the section leaves behind, tracked with the pages that need it rather than here:

- **`Tabs`, controlled variant** — a client-state sibling for D9's role tabs; today's link-based form covers every other use.
- **`Dropdown`, multi-select** — checkbox list + removable chips, when Materials filtering lands (D8).
- **`Accordion`, `Add Circle` expand icon** — D4 contacts and D5 FAQ both want it.
- **The header search field is presentational** until a `/search/` route exists (B7).

---

## Workstream D — Pages

**D1, D2, D7 shipped** (plus the `/materials/articles/` alias). Each remaining item is "build the route + connect it to WP + ship desktop + mobile".

- [ ] **D3. About + team + profiles (`app/about/`, `app/profile/`).** Figma: `about` (`706:70`), `about-learn-more` (`706:1257`), `team-1` (`706:1584`), `team-2` (`708:3736`), `documents` (`706:3499`), `story` (`706:3568`), `Letters-of-appreciation` (`706:3602`), `charter` (`706:3695`), `Certificate` (`760:1662`) — 9 desktop frames, most with mobile variants. The live site has **11** sub-pages and they aren't the same 9 — resolve scope with Design. **Split by traffic:** `/profile/[slug]` is **Tier 2** (566 entries; the CPT is already Gutenberg, so it's one template over existing data); `/about/*` and `/team/` are **Tier 3** — but `/about/` is the most-*viewed* page behind the fallback, so it leads Tier 3. **`Letters-of-appreciation` ✅ 2026-08-19** (D6p) — one transform over the seven post-card pages, `/about/reviews/` and its five children plus `/about/smi/`, which took the whole `/about/reviews/` group off the A6 fallback. **`documents` ✅ 2026-08-19** (D6q) — `/about/experts-review/` and `/about/docs/` on one three-up card grid, without the mock's PDF page previews: 33 of the 56 files live on Yandex Disk and WordPress generated no preview for any of the install's 49 PDF attachments. **`story` ✅ 2026-08-19** (D6r) — `/about/activist-stories/`, 25 videos with the description bottom-aligned to the clip. **`Certificate` ✅ 2026-08-19** (D6s) — `/about/udostoverenie/`, hero + 814/386 rail. **`charter` ✅ 2026-08-19** (D6t) — `/about/ustav/`, a sticky contents column over nine anchored sections, without Figma's active-item pill (it needs a scroll listener a WP body cannot carry). **Open under it: a `core/query` page cannot reach page 2.** WordPress writes the pagination href off `REQUEST_URI`, which for us is the REST request, so it points into `wp-json`. The fix needs the rendering route to read a query parameter, and the catch-all cannot — `searchParams` there makes `/<id>` dynamic and costs every post page its ISR entry. It bites `/about/smi/` (210 posts) and `/about/reviews/letters/` (125); a route of its own under `/about/` is the likely shape.
- [ ] **D4. Contacts (`app/contacts/`) — Tier 2.** `contact` (`754:587`, accordion of contacts) + `contact-page` (`754:675`, page-header banner + a "Наши социальные сети" 3-card grid reusing the News Card). The accordion uses the same `Frame 33976/77` expand/collapse pattern as FAQ. Directory only — the live page has no form, so B6 is not a dependency. The existing `Accordion` needs an `Add Circle` expand-icon variant to match.
- [ ] **D5. FAQ (`app/faq/`) — Tier 4.** Frame `FAQs` (`1569:13336`, 2649×1440). Long single-column accordion (~13 items, `Frame 33985-97`, alternating 48/70-tall collapsed/expanded), same `Add Circle` variant as D4. Near-trivial once content is wired — build it because it's cheap, not because it's needed.
- [~] **D6. Projects / Программы — the Figma detail templates only. Index ✅ 2026-08-15, programme pages ✅ 2026-08-15, `project-1` on `/healthy-russia/` ✅ 2026-08-17, `project-2/3` on `/healthy-youth/` and `/healthy-kids/` ✅ 2026-08-18, index moved into its own WP page ✅ 2026-08-18** (the native-WP-page mechanism, see the notes — **every** WP page now renders natively at its own URL instead of through the A6 iframe, the programme pages included; `shared/config/legacyEmbedPages.ts` lists the 21 exceptions still pinned to the iframe). Still open: long-form `article` (`778:1766`) + `article-mob` (`1567:11148`). Detail pages use a tab strip (`Frame 33787`, ~572×198 — C5) + a 3-card "project items" grid (`Frame 251` etc. with `Frame 151` content). **Traffic says this is smaller than the mocks imply** — zero `/projects/<slug>/` URLs in 91 days; the live «программы» are three top-level pages. That also answers what `project-1/2/3` were: each is one of those pages, named in its own breadcrumb, and all three are now built (D6e, D6f). Design's three open calls are in D6f. ~~Also settle the label~~ — the mock answers it: H1 «ПРОГРАММЫ», second section «Проекты». Left open by the index: the **wide-card variant** (598×280, illustration right) that the mock uses for «Бизнес-клуб» and «ОД ИТ» — unbuilt on `/projects/`, which has six cards in two rows of three; `/materials/` renders it as `.od-tiles--wide` (D6h).
- [~] **D8. Materials (`app/materials/`) — partly Tier 2.** The biggest section. **The `/materials/` index is ✅ shipped** (frame `ads` `778:2206` — four cards; a WordPress page since 2026-08-18, D6h, the route deleted; see [`implementation-notes.md` §3](./implementation-notes.md)); everything below is the sub-pages. Figma templates: `article` (`1012:10934`), `article-content` (`966:8461`), `handbooks` (`779:4133`), `books` (`966:6650`), `disks` (`966:8062`), `printing` (`966:2949`), `flyers` (`966:7747`), `social-ads` (`966:8538`), `social-posters` (`998:9524`), `social-sticker` (`1013:11191`), `social-banners` (`1009:10590`), `social-video` (`1012:11084`), `social-audio` (`1009:10756`), `car sticker` (`966:8388`). ~14 sub-pages, up to 88 assets per page. Depends on C4 ✅, C5 ✅, and the asset-hosting story (E1). **Split, don't build whole:** `plakati` · `zakladki` · `metodichki` are Tier 2; the other ten are Tier 3. `articles` is ✅ done as an alias, and **`metodichki` ✅ shipped 2026-08-17** — the first page through [`wp-page-redesign.md`](./wp-page-redesign.md), so `wp/scripts/od-pages.php`, its test harness and `PersonCard` are now in place. **`printed-products` ✅ 2026-08-18** (D6j), the hub above `books` · `zakladki` · `booklet` · `disk` · `autosticker`, on the same card system as the section index and needing nothing new. **`social-reklama` ✅ 2026-08-18** (D6k), the hub above `plakati` · `billboards` · `audio-roliki-social-reklama` · `led-board-roliki` · `sticker`, the same way. **All five of those ✅ 2026-08-18** (D6l), on one `.od-asset` card written into `post_content` and styled once — which answers B1's content-shape question for this section by not needing it: an asset page is a page, the assets are its blocks, and no CPT or taxonomy was involved. **The other five ✅ the same day** (D6m) — `books` · `zakladki` · `booklet` · `disk` · `autosticker` under the printed-products hub, on the same card. So of the fourteen sub-page mocks only the two `article` templates are left, and the section has no page on the A6 fallback at all: `/materials/audio-roliki-social-reklama/` and `/materials/disk/` came off it when the shortcode and the dead WooCommerce links that put them there went out. Note the index needed **no** answer to the materials-CPT question (it is four links, now four blocks in the page itself) — the sub-pages are where B1's content shape actually bites.
- [ ] **D9. Volunteer / participation page.** The loose `1101:*` Figma scratch. Confirm with Design whether it's still in scope and where it lives (`/volunteer`? `/participation`? part of `/about`?). Needs the **controlled** `Tabs` variant that C5 doesn't have yet.

---

## Workstream E — Media & assets

- [~] **E1. Asset hosting.** Object storage is live and wired. **Left:** a capacity/cost plan for the Materials long-tail (200+ posters + 65+ stickers + …) — the plumbing scales, but nobody has sized the bucket.
- [~] **E2. Image optimisation.** Pipeline is wired. **Left:** confirm what survives the Docker `standalone` build, especially multi-replica (A2).

---

## Workstream F — Quality & polish

- [~] **F1. Testing.** 44 spec files / 197 cases; CI gate done. **Left:** golden-path E2E for `/news`, `/video` and a film page, and a decision on whether E2E belongs in CI (it needs a running WP, so probably a scheduled job).
- [ ] **F2. Accessibility audit.** WCAG 2.1 AA once the design system stabilises. Radix gives a baseline; Carousel, header nav and forms need explicit review.
- [ ] **F3. Core Web Vitals budget.** Targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) wired to CI as a gate.
- [~] **F4. SEO.** Sitemap/robots/canonicals shipped. **Left:** JSON-LD (`NewsArticle` per post, `VideoObject` per film, `Organization` site-wide) and an OG image fallback for pages without a featured image.
- [ ] **F5. Russian-specific polish.** Verify Cyrillic font fallbacks on Windows / older Android. Confirm typographic conventions (em-dashes, non-breaking spaces, `«…»` quotes — confirmed by the live privacy policy).
- [~] **F6. 152-FZ compliance.** The privacy page and the legacy site's cookie consent are done, 2026-08-13 — what changed and why is [notes §5](./implementation-notes.md#f6-152-fz-compliance--the-privacy-page-and-the-legacy-consent-2026-08-13). **What's left rides on two other items:**
  - **Consent banner in the app**, gating Metrica only — lands with **A4** (counter **34478865**). The legacy site has one now, so shipping the app without one would make §15.2 of the published policy false again.
  - **Per-form consent checkbox** — lands with **B6**. The wording is already in the policy, §8.2: «Заполняя соответствующие формы и/или отправляя свои персональные данные Оператору, Пользователь выражает свое согласие с данной Политикой».
  - **Two footer hrefs come from WordPress and break on this origin** — C9 renders widget markup verbatim, and `block-27`'s «Политика конфиденциальности» is the absolute `https://od-dev.tmweb.ru/conf_politics/`, while the СМИ выписка PDF is a root-relative `/wp-content/uploads/…` that only a WP origin answers (the file itself lives on the media CDN). Fix in od-dev's widget, not in `renderFooterWidget`.
  - No GDPR notice, and **Google Analytics does not come back** — it was removed from prod on 2026-08-07 precisely because it shipped visitor data abroad for no need.

---

## Open questions

Real decisions needing a human (Design / PM / org leadership). Questions already answered are in [notes §8](./implementation-notes.md#8-answered-questions-and-superseded-decisions).

### Design / scope

> The version to actually **send to the designer** (Russian, no repo jargon) is [`questions-for-designer.md`](./questions-for-designer.md) — keep the two in sync.

- **Un-tokenized stat accent colours** on the home StatsRow (`#42C880` / `#C383D9` / `#FFC33F` / `#6692FD`) — no token exists, and Figma has no purple or blue scale at all. Hard-coded literals until Design answers.
- **Two reds.** `2_main_red` is `#F4322A`; `brand/red/8` is `#AE0A04` (canonical CTA / header fill). Where does `2_main_red` render? If nowhere, drop the style.
- **`1_main_black` (`#151313`) and `4_line_gray` (`#BDBDBD`)** — neither is wired into the override. Confirm as canonical and wire up, or drop.
- **Spacing scale** — rebase `Box` on multiples of 5, or round in-implementation? (A1b.)
- ~~**Breakpoint set** — add the 1200 tier?~~ ✅ Added with C9. What Design still owes an answer on: **the nav row doesn't fit its own column below 1440** — eight labels plus chevrons measure 1126px against the 1200 frame's 1000px column, and Figma's 1200 and 900 frames simply overflow. Shipped compressed (8px padding) with wrap as the fallback; if the menu grows, this needs a real answer.
- Are the Inter type styles on the `👉 UI` page deprecated or in use? (One known binding: the breadcrumb separator label in `page header`.)
- For pages without an explicit `-mob` frame, is it responsive-only or are mobile mocks coming?
- Status of the «Стань волонтером» iterations and the `1101:*` scratch — still in scope? (D9.)
- **About sub-page scope** — 11 live sub-pages vs 9 Figma mocks, and not the same 9 (D3).
- **Pagination cell geometry** — shipped 40×40/r8 vs the canonical component's 36×36/r6 (C4). Which wins?
- **`Icon Button`'s radius option is named `Curved (8px)` and drawn at 6** in all twelve variants and in every frame that places one. Shipped 6 (`radius/2`); rename the property, or tell us the variants are stale.
- **Three small footer / header colour splits**, all shipped one way and none blocking: the footer's ССЫЛКИ heading is `gray-4` where the other two are `gray-3`; the header search glyph is `gray-1` in `header-v2` and `red-1` in the `Input Field` component; the WordPress legal notice is a link that Figma draws as plain text.

### Content modelling

- **Materials**: is each sub-category a separate WP post type, a taxonomy on a generic "material" type, or a static asset listing? **The biggest unanswered content question — it blocks D8 (Tier 2).**
- **Regional news**: WP has ~80 region categories and a top-level `Региональные новости` (547 posts), but the design specs only three chips. Does regional filtering belong on `/news/`? And should «Наши дела» really map to the catch-all `Новости` (47) or to a narrower curated set?
- **`profile` contact fields (D3).** Narrowed by the B-CPT recon: **region is already structured** (`meta.cmsms_profile_subtitle`, 130/139 — though free-text place names, so displayable rather than groupable), while **phone and email are prose in the body** (92 and 113 of 139). So the only question left is those two — parse them at render time and accept a two-thirds hit rate, have editors backfill them into ACF fields, or drop the contact row from the mock?

### Behaviour

- Forms: which CF7 form ids do submissions post to, where do notifications go, and confirm Yandex SmartCaptcha? (B6.)
- Download tracking: tracked or anonymous? Needs A4 first.
- Authentication for any pages (admin previews, donor-only content)?
- Section label: «ПРОГРАММЫ» (live, and Figma's own `header-v2` nav) vs «проекты» (Figma section name) — pick one.
- Donation CTA: confirm home/header should link to `помоги.общее-дело.рф` (the shipped D1 hero and header already do).

### Infra

- Who holds the Coolify / GHCR credentials, and are stage and prod two apps on one VPS? (The A2 sizing assumes yes.)
- ~~Acceptable cache staleness for editors — is the 1-hour window enough, or must the B4 webhook be installed before launch?~~ **Moot: both halves are built and tested, so instant publishing is now the cheaper option.** It costs two lines of per-tier config at deploy time ([runbook §4.8](./prod-migration-runbook.md)) rather than a decision.
- Backup / disaster-recovery story for WP and uploads?
- Are the sibling properties (`od-pro.ru`, `помоги.общее-дело.рф`, `статы.общее-дело.рф`, the punycode alt) part of this redesign, or strictly cross-links?

---

## Access — what's missing

What we already have is in [notes §6](./implementation-notes.md#6-research--the-live-site-2026-05-29) and [`wp-backend.md` §1](./wp-backend.md#1-access): SSH + WP-CLI and REST on WordPress (**od-dev writable; od-stage / od-test / prod read-only**), Figma via `figma-mcp-go`, browser automation, the Kinescope API token, the Metrica CSV exports, and the Telegram film export.

Each of these blocks a named item:

1. ~~**A frozen-copy host for A6**~~ — **no longer a blocker.** A6 shipped against live production and strips the chrome itself, so neither the chromeless template nor REST on the copy was needed. What remains is a **cutover** blocker: the copy must exist, on a host that is not `obshee-delo.ru`, before this app takes that domain — and it must be cloned with the usual domain search-replace, or 40 % of the links on a typical page stop being rewritten (see A6 above).
2. **Go-ahead to write to od-stage.** A7 cannot be rehearsed anywhere else, and prod must not be the rehearsal.
3. ~~**Prod/stage WP admin** to turn off clearfy-pro's REST block~~ — **not an access problem after all.** On prod the block is one stored option (`clearfy_option.disable_json_rest_api = 'on'`, read 2026-08-13), and WP-CLI over `ssh od-root` can flip it without the admin UI (**prod is on BeGet, not Timeweb** — established 2026-08-15, see [`next-steps.md`](./next-steps.md)). Runbook blocker **B1** is now a **decision** — it exposes prod's REST surface publicly — rather than a credential we're waiting on. Runbook §2.1.
4. **Editorial film data** (B-VIDEO2) — one video link per film, plus posters and featured images. A content problem, but it blocks the largest traffic block on the site.
5. **Yandex Metrica account access** for **A4** — the **counter id is known (34478865**, read off prod's own tag), so what's missing is rights on the account. The consent-banner copy no longer needs sign-off: prod publishes it («Этот сайт использует cookie для хранения данных. Продолжая использовать сайт, Вы даете свое согласие на работу с этими файлами.»), so the app can reuse that wording verbatim.
6. **Forms backend details** for **B6** — CF7 form ids, notification targets, SmartCaptcha keys.
7. **Beget VPS / Coolify + GHCR credentials** to finish the deploy half of **A3**.
8. *(nice-to-have)* **The `wp-block-cb-carousel-v2` plugin source** — `parsePost.tsx` special-cases its markup and nothing documents what else ships with it. Only matters if B8 step 5 gets tricky.

---

## Tracked in GitHub, not here

Real, but they live in the issue tracker. Pulled 2026-05-30.

**Bugs (against the built news flow):** **#55** wrong text colour on the news page · **#64** carousel image close zone too narrow · **#65** missing `border-radius` on some images inside `GutenbergProvider` · **#67** carousel init still uses script injection via `CarouselAdapter.ts` (should move inside `parsePost.tsx`).

**Tech debt:** **#26** Pino + next-logger · **#27** `next/font/google` → `next/font/local` · **#28** Storybook · **#68** GitHub integration polish.

**Open feature issues:** **#32** how to fetch home sections (working assumption: widgets) · **#54** newsletter submission wiring — the form is built but **hidden**, behind `NEWSLETTER_SIGNUP_ENABLED` in `src/shared/config/features.ts`; flip it on only once [`newsletter-unisender.md`](./newsletter-unisender.md) is implemented · **donations** — the footer's «Благотворительная акция» link to `/sp/` is **hidden** (`HIDDEN_HREFS` in `renderFooterWidget.tsx`) because its leyka form has taken no money since 2022-01-05; the open decisions, including item 9 above, are in [`next-steps.md`](./next-steps.md).

---

## Sequencing

**Shortest honest path to prod:**

1. ~~**A6** legacy fallback~~ — **done 2026-08-14**, and not blocked on the frozen-copy host after all. The mechanism that lets Tiers 3–4 ship as-is; it fills the catch-all's non-numeric branch.
2. **B-VIDEO2** film data — protects the 44 % of the site that is video. **Blocked on editors.**
3. **A7** / [`prod-migration-runbook.md`](./prod-migration-runbook.md) — REST on prod, ACF, the worksheet, deploy, verification gates. Re-run gate 12 there; it's A8's only carry-over.
4. **A4** — Metrica (counter 34478865) behind the app's own consent banner. Legally required, traffic-irrelevant. ~~F6's privacy text~~ ✅ is done; the banner is the last Tier-0-adjacent piece, and it is A4's to carry.
5. **Tier 2 pages** — partial D8, D4 contacts, D3's `/profile/[slug]`.

Everything else is post-prod, replaced page-by-page behind the fallback.

**Parallel tracks that don't block the path:** A1b's remaining half (the spacing scale), A3's GHCR step, B8's WP cleanup, F1–F3, F5. ~~C9–C11~~ ✅ closed 2026-08-13.
