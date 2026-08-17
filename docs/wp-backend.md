# WordPress backend — hosting, access, content model

The Next.js app in this repo consumes a WordPress install on **Timeweb shared hosting** (`cs16182@vh426.timeweb.ru`) — but **live production is not there**: it runs on **BeGet**, and the two hosts are the first thing to get straight.

| | Host | Alias | Path |
| --- | --- | --- | --- |
| **Live prod** (`obshee-delo.ru`) | BeGet — `45.130.41.70`, reverse `ssl.dream.beget.com` | **`ssh od-root`** (`obsheedelo_odroot@obsheedelo.beget.tech`) | `~/public_html/` |
| dev / stage / test, and a **stale copy of prod** | Timeweb — `vh426.timeweb.ru` | `ssh timeweb` | see the table below |

**Check before you write.** `dig +short obshee-delo.ru` against the host's IPs settles it; so does making a request with a unique query string and grepping `~/access_log` — on the Timeweb copy it never appears. This cost a full round of edits landing on the copy on 2026-08-15 (found and recorded in [`next-steps.md`](./next-steps.md)). The BeGet install was set up around 2026-08-13 — `servers-agent/ssh/config` describes `od-root` as empty as of that date, and prod's privacy page carries the same `post_modified` on both installs, so the copy postdates the F6 writes.

The Timeweb instances:

| Instance | Path on server | URL | Status |
| --- | --- | --- | --- |
| **od-dev** | `~/od-dev/public_html/` | `https://od-dev.tmweb.ru` (matches `redocly.yml`) | The instance this repo points at via `WP_BASE`. **The only one we write to** — REST is on, content is migrated to Gutenberg, ACF is installed. |
| **od-stage** | `~/od-stage/public_html/` | `https://stage.od.webtm.ru` (probed for the A6 research — confirm it's the same install as this directory) | Staging. **REST disabled** (clearfy-pro), content is cmsms shortcodes. Read-only so far; it is the rehearsal target for [`prod-migration-runbook.md`](./prod-migration-runbook.md). |
| **od-test** | `~/od-test/public_html/` | unknown — confirm with the org | Test. Never probed; unclear how it differs from od-dev. |
| ~~**prod**~~ **prod's stale twin** | `~/public_html/` — the account's default root, *not* `~/obshee-delo.ru/`, which holds only verification files | serves `общее-дело.рф`, as 301s to the live host | ⚠ **Not the live site.** A full copy — same siteurl, same WP 5.5.5, DB `cs16182_delo` — so writes here are invisible. Useful as a read-only reference; never as the edit target. |

**Prod, on BeGet** (`ssh od-root`, `~/public_html`): **WordPress 5.5.5** pinned by an active `wp-downgrade`, **REST disabled**, cmsms shortcodes, no ACF, `wp` at `/usr/local/bin/wp`. Writes so far: 2026-08-13 F6 (privacy page + clearfy's cookie notice, made on Timeweb before the copy, and present here), 2026-08-15 the deletion of three dead nav/footer links (see [`next-steps.md`](./next-steps.md)), and 2026-08-17 two content fixes — the dead `/materials/order-materials/` link on page 21713 and the `href="http://+7-903-722-53-29"` phone on profile 21157 (both also on od-dev; see [`wp-page-passthrough.md`](./wp-page-passthrough.md) §7), followed by `rocket_clean_domain()`. **The prod numbers elsewhere in this file — plugin inventory, cache behaviour, §2's CLI gotchas — were measured on the Timeweb twin**, and while the two matched everywhere they were compared, treat them as expected rather than verified until re-run against BeGet.

**Read this alongside two things:** [`prod-migration-runbook.md`](./prod-migration-runbook.md) (what has to change on stage/prod, in order) and [`legacy-page-fallback.md` §2](./legacy-page-fallback.md) (the read-only probe that established the prod/stage facts above). The redesign started dev-first but is no longer dev-only.

Last verified: **2026-08-13** (core/plugin/CPT/taxonomy numbers below re-probed on that date; the §4 cleanup plan and §6.3 patterns date from 2026-05-29 and are unchanged).

---

## 1. Access

SSH config is already wired via `~/Projects/servers-agent/ssh/config` (Included into `~/.ssh/config`). Always use the alias:

```bash
ssh timeweb                    # dev/stage/test (and prod's stale copy)
ssh timeweb '<command>'        # one-off remote command
ssh od-root '<command>'        # LIVE PROD, on BeGet — ~/public_html
```

Both are shared hosting and multiplex a session for 10 min. `od-root` is a per-site BeGet subaccount: its home is the site directory, with no access to the other OD sites on that account or to their databases.

**Restricted shell.** Shared hosting — **no root, no `sudo`, no `systemctl`, no `apt`**. Cron is managed through the hosting panel, not `crontab -l` (the latter is blocked). Anything below has to be done with user-level tools.

**Secrets discipline.** Do **not** read `wp-config.php`, DB dumps (`~/*.sql`, `~/*.tar`, `~/*.tar.gz`), `.htaccess` secrets, or anything under `wp-content/uploads/private/`. If you need a specific non-secret value (DB name, table prefix), grep for it. See `servers-agent/CLAUDE.md` §"Safety rules" for the full list.

---

## 2. Stack on od-dev

| Component | Version | Notes |
| --- | --- | --- |
| WordPress core | **6.8.8** | Russian-localised admin (post-type labels are in Russian). Auto-updating on the minor line — it was 6.8.5 on 2026-05-29. |
| PHP | **8.2.30 (NTS)** | CLI build dated Jan 2026 — recent. |
| MySQL | (via WP — confirm name in `wp-config.php` if needed) | Connects over unix socket; stream-local SSH forwarding is disabled, so query the DB by running `mysql` server-side, not via tunnels. See `servers-agent/docs/timeweb-pro-moodle.md` §"Querying the DB" for the heredoc pattern. |
| WP-CLI | **2.8.1** at `/usr/local/bin/wp` | Works out-of-the-box. |

### WP-CLI gotcha

`clearfy-pro` does a forced http→https redirect at `init`, which makes WP-CLI dump a redirect warning and stack trace on every command. Workaround: always pass `--skip-plugins=clearfy-pro`:

```bash
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro <command>'
```

Without that flag the output is unusable. With it, all commands run cleanly.

**On prod, `--skip-themes` is required as well** — the CLI's PHP is 8.2 while the site itself runs older, so the `welfare` theme fatals (`functions.php:754`, an optional-parameter-before-required signature) on every command and even `option get` fails:

```bash
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes <command>'   # live prod, BeGet
```

(The same holds on the Timeweb copy at `ssh timeweb ~/public_html` — it's the same site, so the same theme fatals. Verified on BeGet 2026-08-15: with both flags, `option get`, `post list`, `menu item list/delete` and `eval-file` all run cleanly.)

Skipping plugins wholesale is also the safer default there: prod carries 25 active plugins on WP 5.5.5, and a DB-only write (`post update`, `option get/update`) needs none of them. Content written that way still goes through core, so **revisions are created** — page 36316's F6 edit is revertible from `wp post list --post_type=revision --post_parent=36316`.

⚠️ **Prod caches pages with WP Rocket** (10-hour lifespan, `wp rocket` CLI **not** registered). The purge that works from the CLI, verified on BeGet 2026-08-15, is the plugin's own function with plugins loaded:

```bash
ssh od-root 'cd ~/public_html && wp --skip-plugins=clearfy-pro --skip-themes eval "rocket_clean_domain();"'
```

Skipping *all* plugins makes it unavailable; the fallback is deleting `wp-content/cache/wp-rocket/obshee-delo.ru/<slug>/index-https.html*` by hand. Without one or the other the old HTML keeps serving, and an edit looks like it did nothing. Its **"delay JavaScript execution"** also rewrites inline scripts to `type="rocketlazyloadscript"`, deferring them until the first user interaction — anything that must run on load needs a pattern in `wp_rocket_settings.delay_js_exclusions`.

---

## 3. Content model

### 3.1 Custom post types

Beyond core (`post`, `page`, `attachment`, …), od-dev registers:

| CPT | Source plugin | Public | Records | Verdict |
| --- | --- | --- | --- | --- |
| `project` | **cmsms-content-composer** | ✅ | **21** — all `draft`, all from April–May 2015 (`/wp/v2/project` returns **0**, since REST only serves `publish`) | **Demo content from the welfare theme installation.** Titles in English ("Special Needs Assistance", "Disabled People Assistance"), bodies are literal Lorem ipsum. Never published, never used in production. **Delete entirely with cmsms.** Live site's «Программы / Проекты» section is served by plain WP pages, not this CPT. |
| `profile` | **cmsms-content-composer** | ✅ | **205 total, 139 `publish`** — ongoing through 2024 (`/wp/v2/profile` returns the 139) | Real OD regional coordinators / team members. **`post_content` is already clean Gutenberg-block markup** (image + columns + paragraph), thanks to `cmsms-gutenberg-upgrade` having already run a migration. The original cmsms shortcodes survive only as a backup in the `nvp_content_copy` meta field. **Keep — renders like any other Gutenberg post.** Mind the two counts: WP-CLI's `post list --format=count` reports all statuses, REST reports only published, and D3 will surface 139. |
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

| Taxonomy | Object type | Source | In REST? |
| --- | --- | --- | --- |
| `pj-categs` | project | cmsms-content-composer | ❌ `/wp/v2/pj-categs` → **404** |
| `pj-tags` | project | cmsms-content-composer | ❌ |
| `pl-categs` | profile | cmsms-content-composer | ❌ `/wp/v2/pl-categs` → **404** |
| `Carousel` | (carousel slides) | owl-carousel | ❌ |

Standard WP taxonomies (`category`, `post_tag`, `nav_menu`, `post_format`) are also present and carry most of the model this repo actually consumes.

**Tags this project created**, as opposed to inherited — all of them from `wp/scripts/od-terms.php`, which is where they are re-created on any other environment:

| Tag | od-dev id | On | Why |
| --- | --- | --- | --- |
| `programma-zdorovaya-rossiya` «Программа «Здоровая Россия»» | 665 | 6 films | The «Здоровая Россия» methodology is nine lessons, each built on one film, and nothing in the inherited model said which films those are. Three of the nine have no post on the site at all; the tag's docblock names them. Do not confuse it with the inherited tag **72** «Здоровая Россия - Общее дело», which is on ten news posts from 2015–16 and on no film.

**None of the cmsms taxonomies are registered with `show_in_rest`** (verified 2026-08-13), so a headless frontend cannot read them at all — `/wp/v2/types/profile` reports its taxonomies as `["post_tag"]` and nothing else. That matters for D3: there is no coordinator-by-region filter to be had from `pl-categs` unless the re-registration in §4.5 adds `'show_in_rest' => true`. See §3.5 for what the data offers instead.

### 3.3 Category ids the frontend hardcodes

Re-verified 2026-08-13. **These ids are per-environment** — see runbook blocker B5 before pointing the app at stage or prod.

**Where they live in code** — three places, and only the first two are obvious:
- `src/shared/config/filmCategories.ts` — `FILM_CATEGORIES`, keyed by **URL segment**. Read by both video routes, the related-films scope, the SSG seed, `sitemap.ts` and the redirect table. Renaming a key 404s live traffic; the keys *are* the URLs.
- `src/shared/config/newsCategories.ts` — `NEWS_CATEGORIES` (`nashi-dela` 47 / `articles` 578). Read by the `/news/` chips **and** `/materials/articles/`.
- ⚠️ `scripts/lib/wp.mjs` — its own copy of the film ids, because the zero-dep Node scripts can't import TypeScript. It runs in runbook §3, *before* the §4.3 id fix-up, and a wrong id there makes `film:export` write an empty worksheet that reads as "no films need data" rather than an error.

Nothing anywhere should point at a raw id in a URL: both indexes resolve `?category=` by **key**, so an id answers **200 with an unfiltered list** instead of erroring.

| id | slug | name | parent | posts | used by |
| ---: | --- | --- | ---: | ---: | --- |
| `85` | `video` | Видео | — | 12 | parent of the film categories (not queried directly) |
| `581` | `movies` | Фильмы | 85 | 23 | `/video` catalogue + tab |
| `580` | `mult` | Мультфильмы | 85 | 8 | same |
| `86` | `roliki` | Ролики | 85 | 15 | same |
| `559` | `famous` | Известные люди | 85 | 55 | same |
| `52` | `actual` | Видео события | — | 115 | **excluded** from the catalogue — event reports, not films |
| `47` | `novosti` | Новости | — | 7 876 | `/news` «Наши дела» chip |
| `578` | `articles` | Статьи | — | 19 | `/news` «Статьи» chip; also what `/materials/articles/` is made of |
| `547` | `oblast` | Региональные новости | — | 1 886 | not yet surfaced — ~80 region children under it (open question in §8) |

The catalogue is the **union** of `581,580,86,559` = **99 unique films** (the four counts sum to 101 because two posts are double-filed). `format=video` across all posts is **203** — the difference is mostly the 115 «Видео события» reports.

### 3.4 Film metadata — the `group_film_meta` ACF group

The one place the content model is *not* core WP. Films are ordinary posts with `post_format=video`; everything the player page needs beyond title/date/excerpt/featured-image lives in a flat ACF group, **`group_film_meta`** (field-group post id `72999` on od-dev), created via WP-CLI by `setup-film-acf.php` in the ops repo.

**18 REST-exposed keys**, verified over `/wp/v2/posts?format=video&_fields=acf` on 2026-08-13:

`kinescope_id` · `watch_url` · `trailer_url` · `download_{1..5}_url` · `download_{1..5}_label` · `share_vk` · `share_youtube` · `share_rutube` · `poster_image_url` · `poster_download_url`

Three things to know:

- **ACF is canonical; body-parsing is a fallback.** Films' legacy bodies contain the same links as free-form HTML, and the frontend still mines them (`extractFilmPoster`, in-body Яндекс.Диск anchors) — but only to fill what data entry hasn't covered yet, deduped by URL with the ACF value winning. That precedence was a deliberate decision («parsing is not stable»), so don't invert it.
- **Five generic download slots, not a full/short pair.** The label carries the whole pill text (e.g. «Полн. версия • 35 мин • 1,5 Гб») because 11 films ship 2–5 same-duration size/format variants.
- **Population is incomplete and editorial.** 70 of 99 films have a `kinescope_id`, 0 have a `watch_url`. Current numbers and what editors must supply are in [`implementation-plan.md` → B-VIDEO2](./implementation-plan.md#workstream-b--wordpress--data-layer); the CSV round-trip tooling is `pnpm film:export` / `film:import` (see the README).

**Consequence for §4:** ACF is no longer an optional nicety on this install — `/video` does not work without it.

### 3.5 `profile` — what `/profile/[slug]` has to work with (B-CPT)

Recon 2026-08-13, over all 139 published records. `/profile/[slug]` is Tier 2 (566 entry visits), and the point of this pass was to find out how much of D3 is a template over existing data and how much is a content project. Answer: **mostly a template.**

| | |
| --- | --- |
| Published / all statuses | **139** / 205 (REST serves only `publish`) |
| Newest / oldest | 2024-03-31 / 2015-12-09 |
| Featured image | **136 / 139** — `_embed` returns it, so cards get a photo |
| `meta.cmsms_profile_subtitle` | **130 / 139** filled, 89 distinct — REST-exposed, see below |
| Phone in the body text | 92 / 139 |
| Email in the body text | 113 / 139 (both: 87) |
| Body | Gutenberg blocks (group → columns → image + paragraph), median 902 chars, one is empty |
| `acf` | present but `[]` — ACF is active on the type, no field group assigned |
| Taxonomies in REST | `post_tag` only, and just **2 records** use it — useless as a filter |

**`cmsms_profile_subtitle` is the region field, and it already ships in REST** (`meta.cmsms_profile_subtitle`, no ACF needed). Read it before proposing new fields. The caveat is that it's **free text, not a taxonomy**: of 89 distinct values, only 18 name an oblast/republic/krai — the rest are bare settlements («Екатеринбург», «Томск», «Миасс», «г. Якутск»). Good enough to *display* under a name; not good enough to *group by* without a normalisation pass.

**Contact details are prose inside the body**, in mixed formats (`89185700050`, `+79062755758`, `тел.: …`). A third of the records have no phone at all. Any «телефон / email» field in the D3 mock is therefore either a parsing job with a two-thirds hit rate or a data-entry job — this is the concrete form of the ACF question in §8.

**Slugs: 67 of 139 are percent-encoded Cyrillic**, up to 194 characters (`%d1%80%d0%be%d0%bc…` for `романуша-артем-александрович`); the other 72 are ASCII. None collide. This looks like a trap for a `[slug]` route and turns out not to be one — **WP's `?slug=` matches all four spellings** (stored, stored re-encoded, decoded raw, decoded then `encodeURIComponent`, uppercase or lowercase hex; all verified to return the same single record). So `/profile/[slug]` can pass its route param straight to `` `?slug=${encodeURIComponent(param)}` `` without a lookup table. The *URLs* will still be long percent-encoded strings, because that's what the live site already serves.

`/profile/<slug>/` answers 200 on the WP side and `has_archive` is true, so `/profile/` exists there too — worth knowing when the A6 fallback covers this section.

**`project` stays dead.** Re-verified: `/wp/v2/project` returns **0** (all 21 records are 2015 drafts), it exposes **no** taxonomies in REST, and nothing links to it. D6 «Программы» is served by plain WP pages, not this CPT — §3.1's verdict stands, and B8's "do not re-register `project`" with it.

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
| **advanced-custom-fields** | 6.8.3 | **Required, not optional.** Holds `group_film_meta` (§3.4) — the canonical data model behind `/video` and the film player. Installed 2026-06-04 for B-VIDEO, after this table was first written. Free tier suffices (flat fields, no repeater). |
| **contact-form-7** | 6.1.6 | Forms backend (B6). Mainstream, actively maintained, has its own REST endpoint. |
| **wp-openapi** | 1.0.21 | Generates the OpenAPI schema feeding `pnpm generate:types`. *Conditional*: monitor for upstream maintenance; if it breaks under a WP update, fall back to wp-graphql or hand-written types. |
| **wp-graphql** | 2.3.3 | Alternative API surface; useful for the deep-taxonomy Materials section and complex queries. *Conditional*: keep only if we plan to use it. If we commit to REST-only, drop. |
| **leyka** | 3.30.3 | Donations. Russian-domiciled. Keep **if** donations stay on this WP — confirm with the org. If they're moving entirely to `помоги.общее-дело.рф`, leyka and its CPTs go with them. |
| **wp-optimize** | 3.5.0 | Backend DB hygiene (cron-driven cleanup). No frontend impact. Optional but cheap. |
| **query-monitor** | 3.19.0 | Dev-only diagnostic. Disable in prod or restrict to admin users. |

### 4.2 Replace — capability we need, plugin we don't want

| Current plugin | Replace with | Why |
| --- | --- | --- |
| **cmsms-content-composer** + **cmsms-gutenberg-upgrade** | Re-register the `profile` CPT (and its taxonomy `pl-categs` if used) in the **custom headless theme's `functions.php`** — about 15 lines of `register_post_type` / `register_taxonomy`. **No ACF fields needed for `profile` itself**: those records are already plain Gutenberg-block posts (title + featured image + `post_content`). Adding a `profile` **field group** (e.g. `region`, `phone`, `email` as top-level API fields instead of buried in the body) stays optional — the ACF *plugin* is present either way, since films depend on it (§3.4). `project` CPT and its taxonomies (`pj-categs`, `pj-tags`) are **not** re-registered — that data is deleted. `cmsms-gutenberg-upgrade` already did the actual content migration and is no longer needed. | CMSMasters is a paid page-builder we don't want; the content it owned is already converted to core Gutenberg by `cmsms-gutenberg-upgrade`. So the cleanup is "remove the registration shell + drop the migrator", not "rebuild the data model". Keep the CPT registration in theme code rather than leaning on ACF's CPT UI, so the two concerns stay separable. |
| **wysija-newsletters** (legacy MailPoet) | Either modern **MailPoet** (separate plugin family) or move newsletters to a Russian email-marketing SaaS (Unisender, SendPulse RU). | Wysija is unmaintained; if "subscribe to news" actually ships, it needs a current backend. |
| **welfare** theme + `welfare-old/` + `welfare-ver-1-0-9 /` | A stock theme (e.g. **Twenty Twenty-Five** or a 50-line custom minimal theme that just provides `style.css` + `index.php`). | Theme is invisible to end users in headless mode; the only thing it has to do is satisfy WP's "active theme required" check and not interfere with admin. |

### 4.3 Drop — UI-side plugins with no headless purpose

All of these can be deactivated and deleted. The only consequence is that **legacy WP-rendered pages will lose their shortcodes / blocks** — mostly irrelevant once Next is in front, with one live caveat: the **A6 legacy fallback proxies a frozen copy** of the old site, and *that* copy needs cmsms + welfare + these UI plugins to keep rendering. So drop them on od-dev/stage/prod as planned, and leave the frozen copy alone.

**Four of the rows below are already inactive** (verified 2026-08-13) — installed but switched off, so they only need deleting: `debug` 1.12, `infogram` 1.6.1, `loco-translate` 2.6.7, `wp-category-posts-list` 2.0.3.

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
3. **Re-register the `cmsms_profile_subtitle` post meta** with `show_in_rest`, in the same `functions.php`. Easy to miss and it silently breaks D3: that key holds the coordinator's region on **130 of 139** profiles (§3.5) and reaches the API only because cmsms calls `register_post_meta` for it. The *values* survive plugin removal — they're ordinary `wp_postmeta` rows — but the REST exposure does not, so the field would just vanish from `/wp/v2/profile`. It is also why step 7's `DELETE … meta_key LIKE 'cmsms_%'` must **exclude** `cmsms_profile_subtitle`.
4. **(Optional) Install ACF fields on `profile`** only if editors want structured side-fields surfaced instead of buried in the body. ACF is already active on the type (records carry an empty `acf: []`), so this is configuration, not installation. The candidates are `phone` and `email` — prose in the body today, present on 92 and 113 of 139 records respectively — not `region`, which step 3 already covers. Not required to ship.
5. **Switch the active theme** to the new minimal one (welfare goes to trash regardless).
6. **Delete the 21 `project` drafts** (`wp post delete <id> --force` in a loop) before removing cmsms, so they don't end up as zombie rows with no CPT registration.
7. **Remove cmsms-content-composer** and **cmsms-gutenberg-upgrade** together — *after* prod's own migration run, not before. The migrator's source is vendored at [`wp/plugins/cmsms-gutenberg-upgrade/`](../wp/plugins/cmsms-gutenberg-upgrade/) and carries a `wp cmsms` WP-CLI command (`backup` / `migrate` / `restore` / `dump`); see [`wp-page-passthrough.md`](./wp-page-passthrough.md) §6 for how to run it and §5 for the image-link bug fixed in it on 2026-08-16.
8. **(Optional) Hygiene pass:** bulk-delete dead meta keys with `wp db query` — `cmsms_*` and `nvp_content_copy` rows on profile records are now unused. Roughly: `DELETE FROM wp_postmeta WHERE meta_key LIKE 'cmsms_%' OR meta_key = 'nvp_content_copy';`. Saves a few MB and tidies the API responses. **Keep `cmsms_profile_subtitle`** — see step 3; the safe form is `WHERE (meta_key LIKE 'cmsms_%' AND meta_key <> 'cmsms_profile_subtitle') OR meta_key = 'nvp_content_copy'`.
9. **Carousel-block:** before deletion, decide what happens to existing news posts that contain `<!-- wp:cb/carousel-v2 ... -->` block markup. Options: (a) keep carousel-block active for legacy posts only (paradoxical — but it's a single plugin), (b) bulk-edit existing posts to replace `wp-block-cb-carousel-v2` with core `wp-block-gallery` (which `parsePost.tsx` also handles), (c) accept that legacy posts lose their carousels visually. Recommend (b) via a one-off WP-CLI script; record under `servers-agent/tasks/`.

### 4.5 Headless-only theme

Once welfare is gone, the active theme just needs to satisfy WP's "active theme required" check and let admin work. Two options:

- **Stock Twenty Twenty-Five** — no maintenance, ships with WP.
- **A minimal custom theme** (e.g. `~/wp-content/themes/od-headless/` with just `style.css`, `index.php`, `functions.php`). Useful if we want to keep small overrides — e.g. disable the frontend entirely (`add_action('template_redirect', fn() => wp_redirect('https://obshee-delo.ru', 301))`) so visiting WP directly bounces to the Next site.

Either is fine; the minimal custom theme is cleaner if we want frontend bouncing.

---

## 5. Plugin inventory snapshot (as it is right now)

For reference until cleanup lands — **active** plugins on od-dev, versions as of **2026-08-13**:

```
advanced-custom-fields 6.8.3            all_in_one_bannerWithPlaylist 3.6
author-avatars 2.1.20                   carousel-block 2.0.5
cimy-user-manager 1.5.0                 classic-editor 1.7.0
clearfy-pro 3.5.3                       cmsms-content-composer 1.6.2
cmsms-gutenberg-upgrade 1.0.0           contact-form-7 6.1.6
display-categories-widget 3.1           ewww-image-optimizer 8.7.5
google-sitemap-generator 4.1.24         leyka 3.30.3
owl-carousel 0.5.3                      page-list 6.3
query-monitor 3.19.0                    shortcodes-ultimate 7.8.4
simple-blog-stats 20260809              simple-lightbox 2.9.5
taxonomy-terms-order 1.9.9.1            wp-code-highlightjs 0.6.2
wp-downgrade 1.2.6                      wp-graphql 2.3.3
wp-openapi 1.0.21                       wp-optimize 3.5.0
wysija-newsletters 2.21
```

Plus **4 installed-but-inactive**: `debug` 1.12, `infogram` 1.6.1, `loco-translate` 2.6.7, `wp-category-posts-list` 2.0.3.

**27 active now** (26 at the 2026-05-29 audit, + ACF for B-VIDEO) → target **~6 after cleanup**: **ACF** (film fields — required, see §3.4), **CF7** (forms), **wp-openapi** (schema), **wp-optimize** (backend hygiene), **query-monitor** (dev-only), plus **leyka** and **wp-graphql** if those stay. The `profile` CPT registration goes into the custom theme's `functions.php`, not into ACF.

---

## 6. API surface used by this repo

### 6.1 Currently consumed (from `src/shared/api/`)

Verified against the fetchers 2026-08-13. Everything goes through the single `openapi-fetch` client in `httpClient.ts` (Basic auth + throw-on-non-2xx middleware), except where noted.

| Endpoint | Fetcher | Notes |
| --- | --- | --- |
| `GET /wp/v2/posts` | `fetchNewsList`, `fetchLatestNews`, `fetchSimilarNews`, `fetchFilms`, `fetchVideoList` | Paginated via `per_page`/`page`, filtered by `categories` and `format`. **Reads `X-WP-Total` / `X-WP-TotalPages`** for pagination — those headers are part of the contract. |
| `GET /wp/v2/posts/{id}` | `fetchNews` / `cachedFetchNews`, `fetchVideo` / `cachedFetchVideo` | Post detail for both kinds. |
| `GET /wp/v2/posts/{id}?_fields=id,format` | `app/[...slug]/page.tsx` | The A8 dispatch probe — deliberately a **raw `wpFetch`**, not the typed client, because a 404 is an expected answer here rather than an error. |
| `GET /wp/v2/posts?format=video&categories=…` + `.acf` | `fetchVideoList`, `fetchVideo` | The film catalogue and player. Reads the 18 `group_film_meta` keys (§3.4). |
| `GET /wp/v2/menus?slug=main-navigation` | `fetchMenus` | Main navigation (plugin-provided — core REST doesn't ship menus). |
| `GET /wp/v2/menu-items?menus={id}` | `fetchMenuItems` | Menu nodes; `parent === 0` is root, `menu_order` is a depth-first walk (§6.3). |
| `GET /wp/v2/widgets?sidebar=…` | `fetchFooter` | The footer, per the §6.3 widget pattern — this one is **built**, not just planned. |
| `GET /wp/v2/search` | `fetchSearch` | B7's data layer. **No UI calls it yet** — the search input lives in `header-v2`, which is C9. Probed on od-dev 2026-08-13: sends `X-WP-Total{,Pages}`, honours `subtype=page`, and answers an out-of-range page with `200 []` rather than the 400 `/wp/v2/posts` gives. Returns id/title/url/type/subtype only — no excerpt or thumbnail. |
| `HEAD <media-cdn>/<key>` | `resolveMediaUrl` | Not WP: an existence probe against the object-storage bucket, 1 h cached, 200-only (§6.4). |

**Auth note:** every one of these is authenticated with the application password even though the content is public, because `httpClient` injects the header unconditionally. On a CI build with no `WP_*` env, a stub client returns `[]` so compilation still validates.

**Cache note (B3, 2026-08-13):** every runtime call above carries `next: { revalidate, tags }` built by `wpCache()` in `src/shared/api/cacheTags.ts` — `wp` on everything, plus `wp:posts` / `wp:films` / `wp:menus` / `wp:widgets` / `wp:post:<id>` as applicable. The tags are what make the rendered pages purgeable, not just the JSON; §6.5 is the WordPress half.

### 6.2 Available but unused — relevant to upcoming work

- `GET /wp/v2/profile` (139 published) + `GET /wp/v2/profile/{id}` + `GET /wp/v2/profile?slug=…` — team members / coordinators (D3). ⚠️ **not** `/wp/v2/pl-categs`, which 404s — the cmsms taxonomies aren't in REST (§3.2). What D3 can actually read is inventoried in §3.5
- `GET /wp/v2/pages` (**174** published) — generic pages (about, FAQ, contacts, materials landing — depending on how content is organised). Also the denominator for the A6 fallback.
- ~~`GET /wp/v2/search`~~ — **now consumed**, see §6.1. Fetcher only; the results page and the header input are still to build (B7 UI, gated on C9)
- `GET /wp/v2/settings` — site metadata (`.description` is the line under the logo)
- `GET /wp/v2/sidebars/{id}` — the explicit widget-id list, if we ever want a separate cache key (the footer itself already uses `/widgets` — see §6.1)
- `GET /wp/v2/tags?search=...` + `GET /wp/v2/posts?tags={id}` — curated post lists by tag (see §6.3)
- `GET /wp/v2/categories` — would let the `/news` chips and `/video` tabs resolve ids by **slug** instead of hardcoding them, which is what runbook blocker **B5** is about
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

**Footer = widgets in `sidebar_bottom`.** ✅ **Implemented** (`fetchFooter`). `GET /wp/v2/widgets?sidebar=sidebar_bottom` returns an array of widgets in order, each carrying its own `rendered` HTML. The order in the array is authoritative — no need to call `/sidebars/sidebar_bottom` first unless we want the explicit list of widget ids for a separate cache key. Render each `widget.rendered` through the same `html-react-parser` path that news bodies use. Source: #8.

**Search (header).** `GET /wp/v2/search?search=...`. This is the standard WP REST search endpoint — fast enough for the org's content volume (~500–1000 URLs per the live sitemap). Defer Algolia/Meilisearch/Yandex Search unless relevance becomes a problem. Source: #8. **Now in scope** — `header-v2` ships a search input, so this is B7 rather than a maybe.

**Films list.** ✅ **Implemented** (`fetchVideoList` / `fetchVideo`). `GET /wp/v2/posts?format=video` — WP's built-in `post_format` taxonomy, no custom CPT. Categories layer on top via `categories` (OR-matched when passed a list). **One correction to the original design note:** the live site's "5th" film category, *shorts / короткометражки*, **does not exist in WP** — there are only four children of «Видео» 85, and the live `/video/short/` page is a curated list, so A8 redirects it to the unfiltered catalogue. See §3.3. Source: #8.

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
| `shared/lib/wpContent/resolveContentImages.ts` | runs every body `<img>` through `resolveMediaUrl` and strips `srcset` / `sizes` |
| `shared/lib/wpContent/resolveContentLinks.ts` | makes WordPress-origin `<a>` hrefs root-relative (D6c), leaving the `wp-content` / `wp-admin` / … trees absolute — those files exist only on the WordPress host |
| `shared/lib/wpContent/resolveContentHtml.ts` | the two above, composed. **The pipeline's entry point**, ahead of `parsePost` — use it rather than either half |

`next/image` then resizes the full-size source and caches the result (`images.minimumCacheTTL` = 1 day; re-uploads get a new filename → new cache key, and expiry is served stale-while-revalidate). Two images stay low-quality for reasons outside the frontend: one source is missing from the bucket entirely, and a featured-news post's only image is a 599×599 original.

If the WP side later makes the origin reliable or returns CDN URLs directly in the API, set `WP_MEDIA_CDN=""` to disable the rewrite.

### 6.5 On-demand revalidation — the WordPress half (B4)

**Installed on od-dev 2026-08-13** and inert there on purpose: the plugin is in place, the secret is set, and `OD_REVALIDATE_URL` is one commented-out line, because od-dev has no frontend deployment to purge yet. Uncomment it when the tier deploys and the loop closes.

The plugin's source lives in **this repo** — [`wp/mu-plugins/od-revalidate.php`](../wp/mu-plugins/od-revalidate.php) — not inline here, so there is one copy to edit. Installed at `wp-content/mu-plugins/od-revalidate.php` (a *must-use* plugin, so it survives the §4.5 theme swap and can't be deactivated from the admin by accident), with its config in the not-autoloaded `mu-plugins/od-revalidate/config.php` — template at [`wp/mu-plugins/od-revalidate/config.example.php`](../wp/mu-plugins/od-revalidate/config.example.php). Keeping the secret out of `wp-config.php` means a rotation touches one small file that nothing else reads.

**The contract.** POST JSON to `/api/revalidate/` **with the trailing slash** — `trailingSlash: true` makes the bare form a 308 (measured), and this client does not re-POST on a redirect. Authenticated by a shared secret in the `x-revalidate-secret` header (header only — a `?secret=` would land in every access log). The body names what changed:

| Body | Purges |
| --- | --- |
| `{"postIds": [39664]}` | each post's page (`wp:post:39664`) and every listing that can show it (`wp:posts`). What the plugin sends. |
| `{"postId": 39664}` | the singular form, kept for hand-written curl |
| `{"tags": ["wp:menus"]}` | an explicit tag — `wp`, `wp:posts`, `wp:films`, `wp:menus`, `wp:widgets`, `wp:post:<id>` |
| `{"paths": ["/news/"]}` | a route by path, for pages no WP fetch tags (the A6 fallback, mainly) |

Answers 200 with what it purged, 401 on a bad secret, **503 when the deployment has no `REVALIDATE_SECRET`** (so a half-configured tier is inert rather than open), 400 for anything else — including any tag outside the `wp*` namespace, since Next's own implicit route tags (`_N_T_/…`) are addressable through the same API and taking them would turn a leaked secret into a purge of the whole render cache. At most 50 ids, 50 tags and 50 paths per request; the plugin chunks larger batches rather than dropping them.

**What WordPress reports.** `transition_post_status`, plus `trashed_post` / `untrashed_post` / `deleted_post`, `wp_update_nav_menu` → `wp:menus`, and `updated_option` matching `widget_*` or `sidebars_widgets` → `wp:widgets`. Only post type `post` is tagged, which covers films (`format=video`); pages belong to the A6 fallback and will want `paths` when that route exists.

`transition_post_status` rather than the better-named `wp_after_insert_post` for a hard reason: **that hook arrived in WP 5.6 and prod is pinned to 5.5.5**, where it would silently never fire — the plugin would look installed and report nothing. The old hook also hands over both the new and the previous status, which is exactly what the draft rule needs, and it catches a **scheduled post going live through cron** (verified: `wp cron event run publish_future_post` produced the purge), which `wp_after_insert_post` misses. Firing before terms and meta are written costs nothing, because nothing is sent until `shutdown`. The same constraint governs the PHP itself — no typed properties, no `str_starts_with`, no `void` returns, because prod's site PHP is 7.x (`mod_php7`) and 7.4+ syntax in a mu-plugin is a parse error that takes the whole site down.

Everything one request collects is deduplicated and sent **once, on `shutdown`**. That matters more than the choice of hook: by then every write in the request is committed, so the frontend can't refetch ahead of the data. A bulk trash of three posts is one POST carrying three ids, not three POSTs.

Two things it deliberately stays quiet about: a post that was never published (draft → draft, or a draft moving in and out of the bin) never reached the frontend, so purging for it would only throw away a warm cache; and a successful purge writes nothing to `debug.log` unless `OD_REVALIDATE_DEBUG` is on. **Failures always log**, breaker included.

#### The thing that surprised us: `blocking => false` does not make the request fire-and-forget

WordPress's curl transport still calls `curl_exec()` for a non-blocking request and merely throws the response away (`wp-includes/class-wp-http-curl.php`, «We don't need to return the body»). The caller pays the whole connect-and-timeout cost regardless. Measured on od-dev, five identical REST title edits:

| Setup | median save |
| --- | --- |
| plugin inert (baseline) | 2607 ms |
| reachable endpoint | 2771 ms |
| **unreachable endpoint, `blocking => false`** | **8216 ms — every save** |
| unreachable endpoint, with the breaker | 6630 ms once, then 795–1765 ms |

So the plugin is blocking on purpose (the response is the only way to know a purge landed) and protects the editor two other ways: `fastcgi_finish_request()` when the SAPI has it, and a **breaker** — one failure sets a 5-minute transient (`od_revalidate_unreachable`) and no purge is attempted until it expires. **od-dev runs `apache2handler`, not php-fpm**, so `fastcgi_finish_request()` does not exist there and the breaker is the entire protection; expect the same wherever WP stays on this hosting. The cost of the breaker is that edits made during a frontend outage are never purged — the hourly ISR window is the backstop.

#### Install / verify

```bash
# 1. Upload (the mu-plugins dir did not exist on od-dev until this landed)
ssh timeweb 'mkdir -p ~/od-dev/public_html/wp-content/mu-plugins/od-revalidate'
scp wp/mu-plugins/od-revalidate.php timeweb:od-dev/public_html/wp-content/mu-plugins/od-revalidate.php
ssh timeweb 'chmod 600 ~/od-dev/public_html/wp-content/mu-plugins/od-revalidate.php'

# 2. config.php — write it over stdin so the secret never lands in a command
#    line, a shell history or a process list. Template: config.example.php.
S=$(node --env-file=.env -p 'process.env.REVALIDATE_SECRET')
printf '<?php\ndefine( '"'"'OD_REVALIDATE_URL'"'"', '"'"'%s'"'"' );\ndefine( '"'"'OD_REVALIDATE_SECRET'"'"', '"'"'%s'"'"' );\n' \
  'https://<frontend-host>/api/revalidate/' "$S" \
  | ssh timeweb 'T=~/od-dev/public_html/wp-content/mu-plugins/od-revalidate/config.php; cat > $T && chmod 600 $T && php -l $T'

# 3. Is it loaded, configured, hooked? And does WP hold the *same* secret as
#    the frontend — compare digests, never the value.
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro plugin list --status=must-use'
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro eval "
  var_dump( OD_Revalidate::configured(), has_action( \"wp_after_insert_post\", array( \"OD_Revalidate\", \"on_save\" ) ) );
  echo hash( \"sha256\", OD_REVALIDATE_SECRET ) . PHP_EOL;"'
node --env-file=.env -e "console.log(require('node:crypto').createHash('sha256').update(process.env.REVALIDATE_SECRET).digest('hex'))"

# 4. Purge by hand — after a bulk import, or to test the wire
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro eval "
  var_dump( OD_Revalidate::send( array( \"tags\" => array( \"wp\" ) ) ) );"'

# 5. When something is wrong
ssh timeweb 'grep -F "[od-revalidate]" ~/od-dev/public_html/wp-content/debug.log | tail'
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro transient delete od_revalidate_unreachable'
```

**Outbound HTTP from WP works** — that §8 open question is closed. `wp_remote_get('https://example.com/')` answers 200 in 0.26 s and `wp_remote_post` to an external host in 0.54 s, from both the CLI and a web request. No `WP_HTTP_BLOCK_EXTERNAL`.

How the install was tested, since the frontend has no deployment yet and the shared host has no Node to run one: a listener on od-dev's loopback recorded exactly what the plugin sends for every content transition, and those bodies were then replayed against the real route on a production build. Both halves are proven; the one hop nobody has exercised is WP → a *deployed* frontend over the network. Record, with the captures: [`servers-agent/tasks/2026-08-13-od-revalidate-mu-plugin/`](../../servers-agent/tasks/2026-08-13-od-revalidate-mu-plugin/README.md).

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

These are real decisions the org/team has to make — the WP install alone doesn't tell us. Reviewed 2026-08-13; answered items struck through rather than deleted, so the reasoning stays findable.

**Still open**

- **Materials section model** — there's no `material` CPT today. Materials currently live as static WP pages or as ad-hoc posts. The redesign's tab-by-tab structure (books, disks, flyers, posters, …) probably needs a real CPT + taxonomy. **This is now the critical-path content question**: partial D8 is Tier 2 (before prod) on traffic grounds, and it can't start without this.
- **News regions in the UI.** The topic side is settled (chips → 47 / 578). What is *not*: WP has ~80 region categories under «Региональные новости» `547` (1 886 posts; e.g. Ростовская обл. 322) and the design specs no region control. Does `/news` get a region dropdown?
- **Profile side-fields (D3).** Narrowed, not answered, by the §3.5 recon: **region is already structured** and in REST (`meta.cmsms_profile_subtitle`, 130/139 filled — though as free-text place names, 89 distinct, so grouping by it needs normalisation), while **phone and email are prose in the body** (92 and 113 of 139). So the live question is only about those two: parse them out at render time and accept a two-thirds hit rate, have editors backfill them into ACF fields, or drop the contact row from the mock? Design and the coordinators' own preference decide, not the WP state.
- **`od-test` — how does it differ from od-dev?** Same plugins? Same DB? Still never probed. Worth 5 minutes if it's ever going to be a target.
- **Are od-dev's `page` and `profile` bodies representative of prod?** Partly answered and the answer is *no* for pages — od-dev is a migrated-to-Gutenberg copy while prod stores cmsms shortcodes ([`legacy-page-fallback.md` §2](./legacy-page-fallback.md)). **Unverified for `format=video` posts**, which is runbook blocker B2 and the highest-risk unknown in the whole migration.

**Answered since this list was written**

- ~~Which staging level does Next.js point at for what?~~ — one `WP_BASE` per deployment tier; dev → od-dev, stage → od-stage, prod → `obshee-delo.ru`, with a **separate application password per environment**. See §1 and [`prod-migration-runbook.md` §4.1](./prod-migration-runbook.md).
- ~~Will the redesign keep CMSMasters Content Composer?~~ — **no.** It goes to trash along with the welfare theme; `profile` gets re-registered in a minimal headless theme's `functions.php`, `project` is deleted. §4.2 has the plan. Note the frozen copy for A6 keeps cmsms — that's the one place it survives.
- ~~Should Next expose category-filtered news pages?~~ — **yes, shipped.** `/news?category=` with `Все / Наши дела / Статьи` chips (D2).

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

# Video category ids (the ones the frontend hardcodes — see §3.3)
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro term list category --fields=term_id,slug,name,parent,count --format=csv | grep -E "video|movies|mult|roliki|famous|actual"'

# ACF field groups (expect group_film_meta, id 72999 on od-dev)
ssh timeweb 'cd ~/od-dev/public_html && wp --skip-plugins=clearfy-pro post list --post_type=acf-field-group --fields=ID,post_title,post_name,post_status --format=csv'

# Probe an API endpoint
curl -s -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/project?per_page=5" | jq .

# The 18 film ACF keys, plus catalogue totals from the X-WP-Total header
curl -s -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/posts?format=video&per_page=1&_fields=acf" | jq '.[0].acf | keys'
curl -sI -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/posts?format=video&categories=581,580,86,559&per_page=1" | grep -i x-wp-total

# Regenerate OpenAPI types in the frontend repo (must be done from od-frontend)
cd ~/Projects/od-frontend && pnpm generate:types
```

---

## 10. Where to put follow-up notes

Operational tasks against the WP server (DB queries, plugin install/uninstall, content migrations) should be logged under `~/Projects/servers-agent/tasks/YYYY-MM-DD-slug/` per that repo's convention. This doc (`docs/wp-backend.md` in `od-frontend`) is the **reference**, not the task log.
