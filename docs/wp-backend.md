# WordPress backend — hosting, access, content model

The Next.js app in this repo consumes a WordPress install hosted on **Timeweb shared hosting**. There are three OD-related WP instances on the same account (`cs16182@vh426.timeweb.ru`):

| Instance | Path on server | URL (presumed) | Status |
| --- | --- | --- | --- |
| **od-dev** | `~/od-dev/public_html/` | `https://od-dev.tmweb.ru` (matches `redocly.yml`) | The instance this repo currently points at via `WP_BASE` |
| **od-stage** | `~/od-stage/public_html/` | unknown — confirm with the org | Staging, presumably one rung above dev |
| **od-test** | `~/od-test/public_html/` | unknown — confirm with the org | Test |

Production (`obshee-delo.ru`) lives in `~/obshee-delo.ru/` on the same account but is not currently a target of this Next.js build-out (the redesign is dev-first).

Last verified: 2026-05-29.

---

## 1. Access

SSH config is already wired via `~/Projects/servers-agent/ssh/config` (Included into `~/.ssh/config`). Always use the alias:

```bash
ssh timeweb                    # opens (or reuses) a multiplexed session for 10 min
ssh timeweb '<command>'        # one-off remote command
```

**Restricted shell.** Shared hosting — **no root, no `sudo`, no `systemctl`, no `apt`**. Cron is managed through the Timeweb hosting panel, not `crontab -l` (the latter is blocked). Anything below has to be done with user-level tools.

**Secrets discipline.** Do **not** read `wp-config.php`, DB dumps (`~/*.sql`, `~/*.tar`, `~/*.tar.gz`), `.htaccess` secrets, or anything under `wp-content/uploads/private/`. If you need a specific non-secret value (DB name, table prefix), grep for it. See `servers-agent/CLAUDE.md` §"Safety rules" for the full list.

---

## 2. Stack on od-dev

| Component | Version | Notes |
| --- | --- | --- |
| WordPress core | **6.8.5** | Russian-localised admin (post-type labels are in Russian). |
| PHP | **8.2.30 (NTS)** | CLI build dated Jan 2026 — recent. |
| MySQL | (via WP — confirm name in `wp-config.php` if needed) | Connects over unix socket; stream-local SSH forwarding is disabled, so query the DB by running `mysql` server-side, not via tunnels. See `servers-agent/docs/timeweb-pro-moodle.md` §"Querying the DB" for the heredoc pattern. |
| WP-CLI | **2.8.1** at `/usr/local/bin/wp` | Works out-of-the-box. |

### WP-CLI gotcha

`clearfy-pro` does a forced http→https redirect at `init`, which makes WP-CLI dump a redirect warning and stack trace on every command. Workaround: always pass `--skip-plugins=clearfy-pro`:

```bash
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro <command>'
```

Without that flag the output is unusable. With it, all commands run cleanly.

---

## 3. Content model

### 3.1 Custom post types

Beyond core (`post`, `page`, `attachment`, …), od-dev registers:

| CPT | Source plugin | Public | Records | Verdict |
| --- | --- | --- | --- | --- |
| `project` | **cmsms-content-composer** | ✅ | **21** — all `draft`, all from April–May 2015 | **Demo content from the welfare theme installation.** Titles in English ("Special Needs Assistance", "Disabled People Assistance"), bodies are literal Lorem ipsum. Never published, never used in production. **Delete entirely with cmsms.** Live site's «Программы / Проекты» section is served by plain WP pages, not this CPT. |
| `profile` | **cmsms-content-composer** | ✅ | **205** — mostly `publish`, ongoing through 2024 | Real OD regional coordinators / team members. **`post_content` is already clean Gutenberg-block markup** (image + columns + paragraph), thanks to `cmsms-gutenberg-upgrade` having already run a migration. The original cmsms shortcodes survive only as a backup in the `nvp_content_copy` meta field. **Keep — renders like any other Gutenberg post.** |
| `cmsms_like`, `cmsms_view`, `content_template` | cmsms-content-composer | ❌ | (engagement / template plumbing) | Disappear with cmsms. Not used. |
| `leyka_donation` | **leyka** | ✅ | | Donation records — likely surfaces on the donation subdomain, not in this redesign. Keep only if donations stay on this WP. |
| `leyka_campaign` | leyka | ✅ | | Same. |
| `wpcf7_contact_form` | **contact-form-7** | ❌ | | Form definitions (admin-only) — usable for B6 forms. |
| `owl-carousel` | **owl-carousel** | ✅ | | Plugin-driven carousel sliders. Goes with the plugin. |
| `wysijap` | **wysija-newsletters** (MailPoet legacy) | ✅ | | Newsletter pages — only relevant if "subscribe to news" lands here. |

**Key takeaways:**
- **`project` is dead** — drop along with cmsms. No migration, no replacement needed.
- **`profile` is alive but already migrated** — `post_content` is Gutenberg blocks. The CPT registration is the only thing tied to cmsms; once we re-register the CPT (in a theme `functions.php` or ACF), the data renders cleanly via the same `html-react-parser` path as news bodies.
- **No data-migration script is required.** The hard work (cmsms → Gutenberg) was already done by `cmsms-gutenberg-upgrade`. The remaining work is plumbing — re-registering the CPT and optionally cleaning up dead `cmsms_*` / `nvp_content_copy` meta rows.

### 3.2 Custom taxonomies

| Taxonomy | Object type | Source |
| --- | --- | --- |
| `pj-categs` | project | cmsms-content-composer |
| `pj-tags` | project | cmsms-content-composer |
| `pl-categs` | profile | cmsms-content-composer |
| `Carousel` | (carousel slides) | owl-carousel |

Standard WP taxonomies (`category`, `post_tag`, `nav_menu`, `post_format`) are also present and used for the news flow already wired in this repo.

---

## 4. Plugin cleanup — keep / replace / drop

The redesign treats WP as **headless** — Next.js owns rendering. That makes most of od-dev's current plugins dead weight: anything that injects markup, shortcodes, widgets, sidebars, sitemaps, image-block UIs, or page-builder blocks adds nothing at the API layer. The active list will be pruned aggressively.

**Direction agreed with the user:**
- As few plugins as possible.
- Only generic, well-supported, mainstream choices.
- `welfare` theme and everything CMSMasters (Content Composer + Gutenberg Upgrade) is **going to trash**.
- UI-side plugins (carousels, lightboxes, shortcode packs, sidebar widgets) are dropped.

### 4.1 Keep — the lean headless core

These earn their place because they expose data or capability to the REST/GraphQL surface that Next consumes, or maintain backend hygiene.

| Plugin | Version | Why it stays |
| --- | --- | --- |
| **contact-form-7** | 6.1.6 | Forms backend (B6). Mainstream, actively maintained, has its own REST endpoint. |
| **wp-openapi** | 1.0.21 | Generates the OpenAPI schema feeding `pnpm generate:types`. *Conditional*: monitor for upstream maintenance; if it breaks under a WP update, fall back to wp-graphql or hand-written types. |
| **wp-graphql** | 2.3.3 | Alternative API surface; useful for the deep-taxonomy Materials section and complex queries. *Conditional*: keep only if we plan to use it. If we commit to REST-only, drop. |
| **leyka** | 3.30.3 | Donations. Russian-domiciled. Keep **if** donations stay on this WP — confirm with the org. If they're moving entirely to `помоги.общее-дело.рф`, leyka and its CPTs go with them. |
| **wp-optimize** | 3.5.0 | Backend DB hygiene (cron-driven cleanup). No frontend impact. Optional but cheap. |
| **query-monitor** | 3.19.0 | Dev-only diagnostic. Disable in prod or restrict to admin users. |

### 4.2 Replace — capability we need, plugin we don't want

| Current plugin | Replace with | Why |
| --- | --- | --- |
| **cmsms-content-composer** + **cmsms-gutenberg-upgrade** | Re-register the `profile` CPT (and its taxonomy `pl-categs` if used) in the **custom headless theme's `functions.php`** — about 15 lines of `register_post_type` / `register_taxonomy`. **No ACF strictly needed**: `profile` records are already plain Gutenberg-block posts (title + featured image + `post_content`). ACF stays *optional* for surfacing structured side-fields (e.g. `region`, `phone`, `email` as top-level fields instead of buried in the body) — install only if editors want that. `project` CPT and its taxonomies (`pj-categs`, `pj-tags`) are **not** re-registered — that data is deleted. `cmsms-gutenberg-upgrade` already did the actual content migration and is no longer needed. | CMSMasters is a paid page-builder we don't want; the content it owned is already converted to core Gutenberg by `cmsms-gutenberg-upgrade`. So the cleanup is "remove the registration shell + drop the migrator", not "rebuild the data model". Theme `functions.php` is the lighter-touch option than installing ACF just for two `register_post_type` calls. |
| **wysija-newsletters** (legacy MailPoet) | Either modern **MailPoet** (separate plugin family) or move newsletters to a Russian email-marketing SaaS (Unisender, SendPulse RU). | Wysija is unmaintained; if "subscribe to news" actually ships, it needs a current backend. |
| **welfare** theme + `welfare-old/` + `welfare-ver-1-0-9 /` | A stock theme (e.g. **Twenty Twenty-Five** or a 50-line custom minimal theme that just provides `style.css` + `index.php`). | Theme is invisible to end users in headless mode; the only thing it has to do is satisfy WP's "active theme required" check and not interfere with admin. |

### 4.3 Drop — UI-side plugins with no headless purpose

All of these can be deactivated and deleted. The only consequence is that **legacy WP-rendered pages will lose their shortcodes / blocks** — irrelevant once Next is in front.

| Plugin | What it does | Why it goes |
| --- | --- | --- |
| **carousel-block** | Gutenberg block `wp-block-cb-carousel-v2` | UI block. Next renders carousels itself. Plus: see legacy-content note below. |
| **owl-carousel** | Carousel CPT + jQuery slider | Same — second UI carousel system. |
| **shortcodes-ultimate** | 50+ rendering shortcodes | Headless = none of them render. |
| **page-list** | `[pagelist]` shortcode | Same. |
| **wp-category-posts-list** | Category-listing shortcode | Same. |
| **author-avatars** | Avatar listings | UI widget. |
| **all_in_one_bannerWithPlaylist** | Banner/playlist embed | UI widget. |
| **infogram** | Infogram.com embed shortcode | If editors need infogram embeds in post bodies, the iframe HTML survives without the plugin. |
| **display-categories-widget** | Sidebar widget | No sidebars in headless. |
| **simple-blog-stats** | Stats widget | No sidebars. |
| **simple-lightbox** | Frontend image lightbox | Next handles its own modals. |
| **wp-code-highlightjs** | Code-block syntax highlighting | Frontend asset injection. Re-do client-side if needed. |
| **google-sitemap-generator** | Generates `/sitemap.xml` | Next renders sitemaps from `app/sitemap.ts`. |
| **clearfy-pro** | Frontend optimisation bundle + http→https redirect | Conflicts with Next as the public-facing layer. Removing it also kills [the WP-CLI gotcha](#wp-cli-gotcha) entirely. |
| **ewww-image-optimizer** | Server-side image compression on upload | Borderline: useful for shrinking originals at upload time, but `next/image` re-optimises everything anyway. Drop unless we want smaller stored originals (bandwidth between WP and Next). |
| **classic-editor** | Toggles classic ↔ Gutenberg editor UI | Optional. Keep only if editors strongly prefer classic; otherwise let Gutenberg be default. |
| **cimy-user-manager** | Extended user-profile fields | Optional — only matters if extended author fields surface in the API. |
| **debug** | Generic debug helper | Use query-monitor instead. |
| **loco-translate** | String-translation UI | Russian admin is already localised; only relevant if we need to translate plugin strings. |
| **taxonomy-terms-order** | Drag-to-reorder taxonomy terms | Editor convenience. Keep if categories actually need manual ordering; drop otherwise. |
| **wp-downgrade** | Installs a specific WP core version | Emergency tool; reinstall when needed. |

### 4.4 Cleanup ordering (don't break content)

The dangerous step is removing `cmsms-content-composer` while `profile` posts exist in the DB — removing the registration leaves the 205 rows orphaned (still in `wp_posts`, but no CPT means no admin UI and no REST route). Order matters, but the work is much lighter than first framed because `post_content` is already Gutenberg blocks:

1. **Build the custom headless theme** (or pick a stock one) and re-register `profile` + `pl-categs` in its `functions.php` with the same slug + `'show_in_rest' => true`. **Skip re-registering `project`** and `pj-categs` / `pj-tags` — the 21 Lorem-ipsum drafts go away with cmsms (no real data to lose).
2. **Verify** that `/wp/v2/profile` still returns content with cmsms deactivated (toggle in admin, don't delete yet). The Gutenberg-block `post_content` should pass through cleanly — same renderer path as news.
3. **(Optional) Install ACF** only if editors want structured side-fields (`region`, `phone`, `email`) surfaced as first-class API fields instead of being buried in the body. Not required to ship.
4. **Switch the active theme** to the new minimal one (welfare goes to trash regardless).
5. **Delete the 21 `project` drafts** (`wp post delete <id> --force` in a loop) before removing cmsms, so they don't end up as zombie rows with no CPT registration.
6. **Remove cmsms-content-composer** and **cmsms-gutenberg-upgrade** together. The migrator already did its one job; no reason to keep it around.
7. **(Optional) Hygiene pass:** bulk-delete dead meta keys with `wp db query` — `cmsms_*` and `nvp_content_copy` rows on profile records are now unused. Roughly: `DELETE FROM wp_postmeta WHERE meta_key LIKE 'cmsms_%' OR meta_key = 'nvp_content_copy';`. Saves a few MB and tidies the API responses.
8. **Carousel-block:** before deletion, decide what happens to existing news posts that contain `<!-- wp:cb/carousel-v2 ... -->` block markup. Options: (a) keep carousel-block active for legacy posts only (paradoxical — but it's a single plugin), (b) bulk-edit existing posts to replace `wp-block-cb-carousel-v2` with core `wp-block-gallery` (which `parsePost.tsx` also handles), (c) accept that legacy posts lose their carousels visually. Recommend (b) via a one-off WP-CLI script; record under `servers-agent/tasks/`.

### 4.5 Headless-only theme

Once welfare is gone, the active theme just needs to satisfy WP's "active theme required" check and let admin work. Two options:

- **Stock Twenty Twenty-Five** — no maintenance, ships with WP.
- **A minimal custom theme** (e.g. `~/wp-content/themes/od-headless/` with just `style.css`, `index.php`, `functions.php`). Useful if we want to keep small overrides — e.g. disable the frontend entirely (`add_action('template_redirect', fn() => wp_redirect('https://obshee-delo.ru', 301))`) so visiting WP directly bounces to the Next site.

Either is fine; the minimal custom theme is cleaner if we want frontend bouncing.

---

## 5. Plugin inventory snapshot (as it is right now)

For reference until cleanup lands — versions as of 2026-05-29:

```
all_in_one_bannerWithPlaylist 3.6      author-avatars 2.1.20
carousel-block 2.0.5                    cimy-user-manager 1.5.0
classic-editor 1.7.0                    clearfy-pro 3.5.3
cmsms-content-composer 1.6.2            cmsms-gutenberg-upgrade 1.0.0
contact-form-7 6.1.6                    display-categories-widget 3.1
ewww-image-optimizer 8.7.0              google-sitemap-generator 4.1.23
leyka 3.30.3                            owl-carousel 0.5.3
page-list 6.3                           query-monitor 3.19.0
shortcodes-ultimate 7.5.3               simple-blog-stats 20260418
simple-lightbox 2.9.5                   taxonomy-terms-order 1.9.9.1
wp-code-highlightjs 0.6.2                wp-downgrade 1.2.6
wp-graphql 2.3.3                        wp-openapi 1.0.21
wp-optimize 3.5.0                       wysija-newsletters 2.21
```

26 active plugins now → target **~5 after cleanup**: **CF7** (forms), **wp-openapi** (schema), **wp-optimize** (backend hygiene), **query-monitor** (dev-only), plus **leyka** and **wp-graphql** if those stay. **ACF is optional** (only if editors want structured side-fields on profiles); the `profile` CPT registration goes into the custom theme's `functions.php`.

---

## 6. API surface used by this repo

### 6.1 Currently consumed (from `src/shared/api/`)

- `GET /wp/v2/posts` — news listings
- `GET /wp/v2/posts/{id}` — news detail
- `GET /wp/v2/menus?slug=main-navigation` — main navigation menu (provided by a plugin, since core REST doesn't ship menus)
- `GET /wp/v2/menu-items?menus={id}` — menu item nodes
- Footer fetcher (see `src/shared/api/fetchFooter.ts`)

### 6.2 Available but unused — relevant to upcoming work

- `GET /wp/v2/profile` + `GET /wp/v2/profile/{id}` + `GET /wp/v2/pl-categs` — team members
- `GET /wp/v2/pages` — generic pages (about, FAQ, contacts, materials landing — depending on how content is organised)
- `GET /wp/v2/search` — generic site-wide search (see §6.3 for the design decision)
- `GET /wp/v2/settings` — site metadata (`.description` is the line under the logo)
- `GET /wp/v2/widgets?sidebar=sidebar_bottom` + `GET /wp/v2/sidebars/{id}` — widget-based footer (see §6.3)
- `GET /wp/v2/tags?search=...` + `GET /wp/v2/posts?tags={id}` — curated post lists by tag (see §6.3)
- `POST /contact-form-7/v1/contact-forms/{id}/feedback` — form submissions (CF7)
- `POST /wp/v2/...` for write operations (requires the same Basic auth currently used)
- `/graphql` — full GraphQL endpoint (alternative)
- `/wp-json-openapi` — OpenAPI 3 schema source for type generation (`pnpm generate:types`)

**Not** to be used (going away with WP cleanup — see §4.3):
- `GET /wp/v2/project` etc. — 21 Lorem-ipsum drafts, deleted with `cmsms-content-composer`
- `GET /wp/v2/owl-carousel` etc. — UI plugin, dropped

### 6.3 Canonical fetching patterns (from GitHub issues)

These patterns are pre-designed by the WP-side engineer (issues #8, #9, #45, #50). They are the **assumed approach** for upcoming D-series work unless a future ADR overrides.

**Site name beneath the logo.** `GET /wp/v2/settings` → `.description`. Cheap, cacheable; share with the header fetcher.

**Header navigation (menu).** Already wired. Hierarchy rule: `parent === 0` = root; nested items reference their parent by id. `menu_order` is a depth-first walk over the tree — usable as the canonical sort. GraphQL was tried and is **buggy** for nested menus (returns null `childItems` past one level) — REST is the right call here. Source: #8.

**Footer = widgets in `sidebar_bottom`.** `GET /wp/v2/widgets?sidebar=sidebar_bottom` returns an array of widgets in order, each carrying its own `rendered` HTML. The order in the array is authoritative — no need to call `/sidebars/sidebar_bottom` first unless we want the explicit list of widget ids for a separate cache key. Render each `widget.rendered` through the same `html-react-parser` path that news bodies use. Source: #8.

**Search (header).** `GET /wp/v2/search?search=...`. This is the standard WP REST search endpoint — fast enough for the org's content volume (~500–1000 URLs per the live sitemap). Defer Algolia/Meilisearch/Yandex Search unless relevance becomes a problem. Source: #8.

**Films list.** `GET /wp/v2/posts?format=video` — uses WP's built-in `post_format` taxonomy, no custom CPT. The 5-category split on the live site (full films / animated / clips / shorts / "famous people") layers on top via `categories` query params, same pattern as news regions below. Source: #8.

**News listings.** Two modes, switched by config (single env var or feature flag):
- **Default (latest):** `GET /wp/v2/posts` — what the home news grid (§7 in the home composition) ships with day-one.
- **Curated home block:** `GET /wp/v2/tags?search=главная` → take the returned tag id → `GET /wp/v2/posts?tags={id}`. Reason for the toggle: editors may forget to tag, and summer historically has few items, so the curated mode silently falls back to "latest" if zero curated items.

The single-news endpoint is `GET /wp/v2/posts/{id}` (already wired — see `cachedFetchNews`). Source: #8, #45.

**"Popular news" = same-region news, not a popularity plugin.** Each post returns `categories: [47, 137, …]` where one is the topic (e.g. `47 = новости`) and the rest are regional tags (e.g. `137 = владимирская область`). Related-posts query: `GET /wp/v2/posts?categories=47&categories=137`. The label «популярное» should be **config-driven** — if a real popularity plugin (`wp-postviews`, etc.) is installed later, the fetcher swaps in place without rewriting the UI. Source: #50.

**"Sections" / custom homepage content (hero, statistics, banners).** _Unresolved._ Issue #9 is `in progress` and weighs four options:
1. **JSON / HTML files dropped into `wp-content`** — simplest, fastest. No webhook capability but acceptable for rarely-changed content (hero copy, statistics numbers, footer text).
2. **Widgets** (Arsennikum's leading candidate) — editable via the WP admin without publishing technical "posts". Each section becomes a widget that returns rendered HTML, same pattern as footer.
3. **ACF custom fields on a single "site config" page** — adds typed fields, surfaces as a JSON section in REST. Requires keeping that page published and filtering it out of `/wp/v2/posts` results.
4. **Custom REST endpoints** in the theme's `functions.php`. Maximum control, more code.

**Working assumption pending resolution:** widgets for most one-off blocks (matches the footer pattern, no plugin dependency, no FSE/theme switch needed). Revisit when D1 hero/banner/statistics issues (#33, #34, #36) start, since each can be implemented either way.

### 6.4 Media images — object-storage offload + the resolution pipeline

WordPress uploads on od-dev are **offloaded to a Yandex object-storage bucket** (`https://obshee-delo.website.yandexcloud.net`). The origin keeps the canonical URLs and **301-redirects** offloaded files to the bucket. Consequences the frontend has to handle:

- **The origin is slow and intermittently 500s.** A cold image fetch through the origin redirect is ~1.3s and sometimes fails outright; hitting the bucket directly is ~0.8s and reliable.
- **Only full-size originals are reliably on the bucket.** WordPress's resized variants (`name-WIDTHxHEIGHT.ext` — `-150x150`, `-300x169`, …) frequently **500 / 404**. The REST API and post-body HTML still reference those variants (in `_embedded` `source_url`, and `content.rendered` `<img src>` / `srcset`), so never use a sized URL as-is.
- **The bucket 301s missing keys** (to an error page) rather than 404ing — so an existence probe must count only a direct HEAD `200` as "present".
- **Not every file is offloaded.** Recently published media (e.g. the latest news) can live only on the WP origin until the offload job runs.

The resolution pipeline (all under `src/shared/api/`, applied at fetch/render time so the client only ever receives a good URL):

| Helper | Job |
| --- | --- |
| `imageUrl.ts` → `toFullSizeImageUrl` | strip the `-WxH` suffix to the full-size original (leaves `-scaled` alone) |
| `mediaCdn.ts` → `getWpMediaCdn` / `DEFAULT_WP_MEDIA_CDN` | committed CDN base; `WP_MEDIA_CDN` env overrides it, `""` disables. Also feeds `next.config.ts` `images.remotePatterns` so the host is always allowlisted |
| `mediaUrl.ts` → `resolveMediaUrl` | full-size **and** CDN-when-the-object-exists (cached HEAD, 200-only), else WP origin. Used by `fetchFilms` / `fetchLatestNews` |
| `src/modules/News/utils/resolveContentImages.ts` | runs every news-body `<img>` through `resolveMediaUrl` and strips `srcset` / `sizes`; applied in the news route before `parsePost` |

`next/image` then resizes the full-size source and caches the result (`images.minimumCacheTTL` = 1 day; re-uploads get a new filename → new cache key, and expiry is served stale-while-revalidate). Two images stay low-quality for reasons outside the frontend: one source is missing from the bucket entirely, and a featured-news post's only image is a 599×599 original.

If the WP side later makes the origin reliable or returns CDN URLs directly in the API, set `WP_MEDIA_CDN=""` to disable the rewrite.

---

## 7. Known gotchas

- **`clearfy-pro` redirect** — see WP-CLI section. Also can force-redirect curl/fetch requests that don't match its host rules. If a fetcher gets 301'd to a different scheme/host, it's clearfy-pro.
- **Two carousel systems coexist**: `carousel-block` (Gutenberg block, used in news bodies) and `owl-carousel` (plugin-driven CPT). Don't conflate them. The Next code currently only handles the former (via `parsePost.tsx`).
- **Cron is panel-managed**, not via `crontab`. If WP scheduled tasks (sitemaps, optimiser cleanups) stop firing, check the Timeweb panel.
- **The `welfare-ver-1-0-9 /` theme directory has a trailing space in its name.** Tab-complete will trip on it — quote it explicitly.
- **`debug.log.tar.gz`, `strace.log`, `1bcf68f1e3f797e17efd6e50a618ffcf.txt`, `u0137327_od_rf.sql`** — assorted debug / dump artefacts sit at the docroot of od-dev. Treat as secret-bearing; don't read.
- **WP-OpenAPI maintenance:** the plugin is one-author and infrequently updated. If a future WP-core change breaks it, options are (a) hand-write types, (b) switch to wp-graphql + a code-gen GraphQL client, (c) fork the plugin.
- **Media is offloaded to a Yandex bucket; the origin 301s to it, is slow + flaky, and resized image variants (`-WxH`) often 500.** Always resolve images to full-size + CDN via `resolveMediaUrl` / `resolveContentImages` — see §6.4. (This media 301 is the offload plugin, distinct from the clearfy-pro redirect above.)

---

## 8. Outstanding questions the WP state doesn't answer

These are real decisions the org/team has to make — the WP install alone doesn't tell us:

- **Which staging level does Next.js point at for what?** Right now `WP_BASE` → `od-dev`. Should there be a `WP_BASE` per Next deployment tier (dev → od-dev, stage → od-stage, prod → obshee-delo.ru)? `od-stage` and `od-test` directories exist but their URLs / purposes aren't documented.
- **Are projects and profiles in od-dev representative of prod content,** or is dev a stale snapshot? Affects whether we can develop against real shapes or need to seed test data.
- **Will the redesign keep CMSMasters Content Composer** as the content model, or migrate `project` / `profile` to plain WP custom post types managed via ACF / Meta Box? CMSMasters is a paid page-builder; if the team wants to ditch it, the CPT registrations need to move into a small mu-plugin or theme code.
- **Materials section model** — there's no `material` CPT today. Materials currently live as static WP pages or as ad-hoc posts. The redesign's tab-by-tab structure (books, disks, flyers, posters, …) probably needs a real CPT + taxonomy. Concrete proposal needed before D8 starts.
- **News categories / regions** — `cachedFetchNews` currently grabs `data.categories`. Confirm whether categories carry region/topic and whether Next should expose category-filtered news pages.
- **What does `od-test` differ from `od-dev`?** Same plugins? Same DB? Worth a quick comparison if either is going to be a target.
- **Webhook capability for on-demand revalidation (B4).** Does the Timeweb shared host let outbound HTTP fire from WP hooks (e.g. `save_post` → `wp_remote_post(NEXT_REVALIDATE_URL)`)? Probably yes, but worth confirming there's no egress restriction.

---

## 9. Useful one-liners

For quick re-discovery later:

```bash
# WP version + PHP version
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro core version && php -v | head -1'

# All active plugins
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro plugin list --status=active --fields=name,version --format=csv'

# All custom post types (public ones only)
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro post-type list --public=true --fields=name,label --format=csv'

# All taxonomies
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro taxonomy list --fields=name,label,object_type --format=csv'

# Count posts per post type (without loading bodies)
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro post list --post_type=project --format=count'

# Probe an API endpoint
curl -s -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/project?per_page=5" | jq .

# Regenerate OpenAPI types in the frontend repo (must be done from od-frontend)
cd ~/Projects/od-frontend && pnpm generate:types
```

---

## 10. Where to put follow-up notes

Operational tasks against the WP server (DB queries, plugin install/uninstall, content migrations) should be logged under `~/Projects/servers-agent/tasks/YYYY-MM-DD-slug/` per that repo's convention. This doc (`docs/wp-backend.md` in `od-frontend`) is the **reference**, not the task log.
