# Production migration runbook

Everything needed to put the Next.js redesign live at **`obshee-delo.ru`**, in execution order, with the verification gate for each step.

> **The cutover is a domain swap, not a migration in place — decided 2026-08-20.** See §0.4. It collapses several of the blockers below and makes the whole of §2 a *single* procedure, the one already rehearsed end to end on od-stage. Read §0.4 before anything else here; wherever an older paragraph says "on prod, do X", §0.4 is what overrides it.

> ⚠ **Prod lives on BeGet: `ssh od-root`, `~/public_html`.** Not Timeweb — `obshee-delo.ru` resolves to `45.130.41.70` (`ssl.dream.beget.com`), while `ssh timeweb ~/public_html` is a full *copy* of the same site that now serves only `общее-дело.рф` as 301s, so edits there are invisible. Established 2026-08-15, after a round of edits landed on the copy. The prod commands below have been repointed at `od-root`; the prod *measurements* (§2.5's PHP/mod_php notes, the plugin inventory, the WP Rocket behaviour) were taken on the twin and are marked where they matter. Two tells if you're unsure which install you're on: `dig +short obshee-delo.ru` against the host's IPs, and a request with a unique query string that never shows up in the copy's `~/access_log`.

> **Read this first.** Every step below has been executed **only against od-dev and od-stage**. **od-stage was wiped and re-synced from live prod on 2026-08-20** (§0.5) and then taken headless the same day (§0.6), so B1, B2 and B10 now have a proven procedure rather than a plan — read §0.6 before §1, because it supersedes the skip-flag ritual below and corrects §2.1. Prod has, three times and narrowly: 2026-08-13's F6 privacy page + cookie notice (on Timeweb, before the copy diverged), and 2026-08-15's deletion of three dead nav/footer links (on BeGet — [`next-steps.md`](./next-steps.md)). Everything else in this runbook is unexecuted. Prod facts in §0 come from a **read-only probe** recorded in [`legacy-page-fallback.md` §2](./legacy-page-fallback.md). Treat them as *expected*, and re-verify in §1 before acting. **Under §0.4's model prod is never the target of §2 at all** — it is only ever the source of a clone and, after cutover, the frozen copy.

Related: [`implementation-plan.md`](./implementation-plan.md) (task state) · [`wp-backend.md`](./wp-backend.md) (hosting, access, plugins) · [`legacy-page-fallback.md`](./legacy-page-fallback.md) (un-redesigned pages).

---

## 0. Hard blockers — nothing works until these are resolved

| # | Blocker | Why it stops the migration | Owner |
|---|---|---|---|
| **B1** | **REST is disabled on prod.** **Closed on stage 2026-08-20 (§0.6), and under §0.4 it never has to be touched on prod at all** — the clone is what gets opened. **It was never one switch.** `clearfy_option.disable_json_rest_api = 'on'` is only half; `welfare/functions.php:729–748` kills REST outright with `rest_enabled → false` and `remove_action('parse_request','rest_api_loaded')`, unconditionally at theme load, with no option to flip. Deactivating clearfy alone left stage still answering **404**. | The entire app is REST-only (`httpClient.ts` → `WP_BASE/wp-json`). Zero pages render. **This is the single largest blocker** — but see §2.1: it no longer needs anyone's admin login. | ~~WP admin~~ **us, over SSH** |
| **B2** | ~~unverified for posts~~ — **measured and closed on stage 2026-08-20 (§0.6).** Prod holds shortcodes in **everything**: 5393 posts, 144 pages, 132 profiles, zero Gutenberg blocks anywhere. The migrator converted all of it; 10 occurrences on 10 pages remain. | If film/news bodies are `[cmsms_*]`, then `parsePost`, `GutenbergProvider`, `extractFilmPoster` and `absolutizeWpMedia` all degrade to raw shortcode text. See §1.4 — this is the highest-risk unknown. | verify in §1 |
| **B3** | **ACF is not installed on prod/stage.** Still open — §0.6's open list item 2. | No `group_film_meta` ⇒ no `acf` object in REST ⇒ every film affordance disappears. | §2.2 |
| **B4** | **Post ids are per-environment.** | The worksheet we filled holds od-dev ids; importing it into the new install would write to unrelated posts. Mitigated by `pnpm film:remap` (§3.2). Under §0.4 the clone carries **prod's** ids, so this is resolved once and stays resolved through the swap. | §3 |
| **B5** | **Category ids may differ.** `581/580/86/559` are hardcoded — since 2026-08-13 in **one** file, `src/shared/config/filmCategories.ts`. | A wrong id silently empties the catalogue and the related-films strip — it answers 200, so only a count check catches it. | §1.3 + §4.3 |
| **B6** | **Media offload origin unconfirmed for prod.** | `WP_MEDIA_CDN` defaults to the od-dev bucket; a different prod bucket breaks every image. | §1.5 + §4.1 |
| ~~B7~~ | ~~Hosting/deploy target undecided~~ — **decided: Beget VPS + Coolify, images built in GitHub Actions → GHCR.** | Remaining work is the CI push step (§4.7), not a decision. | §4 |
| **B8** | **7 native routes, plus 110 WordPress pages redesigned by `od-pages.php` and 44 passed through un-redesigned** — the census is [`page-inventory.md`](./page-inventory.md) (re-measured 2026-08-20). | Launching without the A6 legacy fallback means every page WordPress does not answer for 404s. **Launch gate, not a migration step** — see §6. The six paths still on the iframe are **0.5 % of entry traffic and 1.6 % of pageviews** — down from 13.5 / 20.0 % before D3, D4 and D6, so this is no longer the launch risk it was priced as. | A6 |
| **B10** | **Prod runs WordPress 5.5.5**, pinned by an active `wp-downgrade`. **Closed on stage 2026-08-20 (§0.6):** 5.5.5 → **7.1**, and the migrated bodies verifiably render `is-layout-flex`. Under §0.4 prod's own core is never upgraded — the clone's is, which also removes prod's `mod_php7` minor as a constraint (§2.7). | `cmsms-gutenberg-upgrade` emits `wp:query`, `wp:details` and `wp:group`, and the layout classes `gutenberg.css` keys on (`is-layout-flex`) are emitted by core **5.9+**. On 5.5.5 the query blocks render **empty** — that is the news feed on ~80 regional `/contacts/*` pages — and every `wp:columns` stacks. It fails quietly: the page answers 200 with content missing. **Must happen before the migrator runs.** | §2.7 |
| ~~B9~~ | ~~The redesigned routes don't match live URLs.~~ — **FIXED 2026-08-13 (A8).** `/<id>` is served directly by `app/[...slug]/page.tsx` and the four film categories by `app/video/[segment]/page.tsx`; `src/proxy.ts` (driven by `resolveLegacyUrl` in `src/shared/config/legacyRedirects.ts`) redirects the rest — the **whole** `/category/*` family, `/video/short/` and every `/page/N/` shape — in **a single 301 each**; `trailingSlash: true` matches the live URL form. F4's sitemap/robots/canonicals shipped alongside, so nothing we advertise redirects. | Was **59 % of all site entries**. Now a **verification** concern rather than a build one — gate 12 in §5 is what proves it, and it is scriptable. | verify in §5 |

---

## 0.4 The cutover model — build the replacement, then move the domain

**Decided 2026-08-20.** Prod is not migrated in place. A **new WordPress install** is cloned from live prod, prepped headless exactly as od-stage was (§0.6), and served at its own hostname — **which should be the permanent one from the start**, `wp.obshee-delo.ru` rather than `new.…`, for the reason §5.5 gives. The frontend is pointed at it and verified there. At cutover the **apex** moves to the frontend in front of it. The old install keeps its files, its database, its theme and its plugins, and simply stops being `obshee-delo.ru`.

**Six things follow, and they are why this is worth stating before the steps.**

1. **§2 is one procedure, not two.** Everything in it runs against an install that nobody is reading yet, so there is no window to protect: delete `welfare`, deactivate cmsms, prune, upgrade core, convert. The clone/prod fork an earlier draft of §2.1 carried is void — and so is the mu-plugin that was going to restore REST without removing the theme. Nothing needs it.
2. **B1 and B10 stop being prod blockers.** Prod's core is never upgraded, its `clearfy-pro` is never touched, its theme never deleted. Both are properties of the *clone*, resolved once during prep and never again. What survives of B1 is a narrower decision: the new install's REST is public once it holds the prod domain — see §2.1's warning, which still applies to *it*.
3. **Prod's PHP version stops blocking anything, and the constraint inverts.** We never run WP 7.1's `php >= 7.4` check against prod, so its `mod_php7` minor is irrelevant. The new install's PHP is a thing we *choose* — od-stage is on 8.2.32 and that is the target. But the old install must **stay on PHP 7**: `welfare/functions.php:754` fatals under PHP 8 (§2.7), and the old install is what the A6 fallback renders. Moving it to 8.x after cutover would kill the frozen copy.
4. **The A6 frozen copy costs nothing now.** It is the old install, given a subdomain instead of the apex. No capture step, no separate snapshot to keep in sync, and it keeps `welfare` + cmsms because we never touched them. Four edits are needed at cutover, listed in §5.5 and already documented in §0.5 from doing them twice: `WP_HOME`/`WP_SITEURL`, the `.htaccess` canonical-host 301, a database search-replace, and the `siteurl`/`home` option rows the defines mask. Skip the second and every request to the frozen copy 301s straight back at the apex. It also wants shutting off from the public — `Require ip` for the frontend VPS plus `X-Robots-Tag: noindex`, and **not** a 301, which would render the home page into all six iframes at 200. §5.6 has both hosts' rules and why `wp.obshee-delo.ru` must *not* get the same allowlist.
5. **Rollback becomes trivial, and that is the point of the model.** Every gate in §5 runs before the domain moves. If something is wrong afterwards, the domain moves back to an install that was never modified. Compare the in-place version of this plan, where the return path was a database snapshot taken before 5669 bodies were rewritten.
6. **Ids settle once.** The clone carries prod's own post and category ids, so §1.3's numbers, `filmCategories.ts` (B5) and `film:remap` (B4) are resolved against the clone and stay correct through the swap. There is no per-tier id dance after cutover.

**The content gap: an editorial pause, agreed by hand — decided 2026-08-20.** Edits between the clone and the swap would not reach the new install, so editors simply stop during that window. The site is not edited often and the pause is arranged as a process, so **nothing has to be locked technically** — no read-only mode, no plugin, no capability change. Which also means the prep runs **once**, on **one** clone: re-clone-and-re-prep is a fallback if something goes badly wrong, not the plan, so nothing in §2 has to be built for repeatability. (It happens to be repeatable anyway — `wp cmsms backup` skips rows that already carry `nvp_content_copy`, `migrate` skips content that already matches, and workstream D's scripts are idempotent.)

⚠ **The pause is as long as clone → cutover, so keep that window mechanical.** It is not just §2: everything between the clone and the DNS change sits inside it, verification included. So settle on **od-stage** everything that does not need the fresh clone — §1.3's category ids, the `generate:types` diff, ACF and the film worksheet, workstream D's scripts, the frontend build and §5's gates — because od-stage already carries prod's own content and ids and answers the same questions. What should be left for the new install is the §2 pass, the film data import against real ids, and a re-run of the gates. od-stage's whole value is making that window short.

**Where the new install lives: BeGet, beside prod — decided 2026-08-20.** So the swap is a vhost plus DNS change, and mail, cron, TLS and the `.htaccess` 301s that send 2009–2023 uploads to the Yandex bucket all stay where they are. od-stage on Timeweb stays what it is now: the rehearsal, not the article. Two practical consequences:

- **The clone is server-side.** Same account, so prod's tree and database never leave the host — `cp -a` and a `mysqldump | mysql` between the two, not the 5 MB/s stream through a local machine that od-stage's copy needed.
- **Check the account boundary before assuming that.** `od-root` is a **per-site subaccount** whose home *is* the site directory, with no access to the account's other sites or their databases ([`wp-backend.md` §1](./wp-backend.md#1-access)). Creating the sibling site, and getting a shell that can see both, is a panel action and may come with different credentials. Establish that first — it is the one thing that could turn a same-host clone back into a stream.

---

## 0.5 od-stage is a prod clone as of 2026-08-20

`~/od-stage/public_html` on `ssh timeweb` was emptied and re-created from live prod (`ssh od-root`, `~/public_html`): the whole file tree bar `wp-content/cache`, plus a full `obsheedelo_od` dump loaded into od-stage's own database (`cs16182_odstage` — its credentials are the only thing carried over). The §0 blockers are therefore **measured on stage now, not assumed**: REST answers **404** (B1), content is CMSMasters shortcodes (B2), ACF is absent (B3), and the theme is `welfare` on **WP 5.5.5** pinned by an active `wp-downgrade` (B10).

- **Host: `https://od.webtm.ru`** — that is what the commands below use, and its certificate is valid. It started life at `stage.od.webtm.ru`, which no certificate covered: timeweb's wildcard is `*.webtm.ru`, and a wildcard matches **one** label, not two. Both names still resolve and the old one 301s to this one. Web PHP on the vhost is **7.4.33**, the same family as prod's mod_php7, so the site renders; only WP-CLI needs the flags in §1.
- **Repointed, and nothing else:** `WP_HOME`/`WP_SITEURL` in `wp-config.php`, the `.htaccess` canonical-host 301 (left alone it sends every stage request straight to prod), 266 `https://obshee-delo.ru` occurrences in the database, and the `sm_status` option (deleted — it held a prod sitemap URL and leaked it into the front page's HTML). The 197 posts referencing `общее-дело.рф` are prod's own outbound links and were left as they are, as are the `@obshee-delo.ru` mail addresses in `widget_text` and the Leyka/WooCommerce options — those are the only prod-host strings left in `wp_options`, and none of them is a link. One row did need a hand: prod's own `siteurl`/`home` **options** still say `https://cs16182.tmweb.ru` from before the BeGet move — harmless there because `wp-config.php`'s `WP_HOME`/`WP_SITEURL` override them, but on stage they were set to the real host so nothing reading the option directly is misled.
- **Parity, verified after the load:** 8404 posts / 163 pages / 17961 attachments / 367 MB database — identical to prod — `/?p=<id>` 301s to `/<id>/` and answers 200, a 2026 upload serves locally, and a 2016 one still 301s to the `obshee-delo.website.yandexcloud.net` bucket. The stage-only WooCommerce tables are gone.
- **Rollback of the pre-sync stage:** `~/od-stage-pre-prod-20260820/` (database dump, old `wp-config.php`, old `.htaccess`) plus the older `~/od-stage/backup-od-stage-27.07.2025-55.tar`.

---

## 0.6 od-stage headless prep — executed 2026-08-20

§0.5 left od-stage a byte-faithful copy of prod: WP 5.5.5, `welfare`, 21 active plugins, REST 404, every body in CMSMasters shortcodes. It is now **headless-ready**, and the sequence below is the one **the new install** has to follow (§0.4 — prod itself never runs it). **B1, B2 and B10 are closed as a procedure, proven on a real prod clone.**

**Backups.** `~/backups/<NN-slug>/` on `ssh timeweb`, one per step, written by `~/od-backup.sh <slug> [--full]`: `db.sql.gz` + `files.tar.gz` + `MANIFEST.txt` (timestamp, core version, active theme, active plugins). Each snapshot is taken **before** the step it is named for, so `NN` restores the state that step started from; `07-migrated` is the good end state. Only `00-baseline` is `--full` (whole tree, 1.3 GB) — the later tars carry `wp-config.php`, `.htaccess` and `wp-content/{plugins,themes,mu-plugins}` only, because uploads never changed. The script refuses to overwrite an existing slug and runs WP-CLI under PHP 7.4, so it works on both sides of step 05.

**01 · `wp-rocket` + `clearfy-pro` deactivated.** REST still answered **404** — which is the finding: clearfy's `disable_json_rest_api` is *not* the only switch, and §2.1 was wrong to treat it as one.

**02 · theme swapped to `twentytwentyone`, `welfare` deleted.** *This* is what opened REST. (Deleting the theme is the *clone's* answer, not prod's — §2.1 now carries all three ways to lift this switch and which one belongs where.) `welfare/functions.php:729–748` ran `add_filter('rest_enabled','__return_false')` plus `remove_action('parse_request','rest_api_loaded')` and four sibling `remove_action`s, unconditionally at theme load — no option, no toggle, nothing WP-CLI could flip. **B1 has two switches and the theme's is the harder one.** Two side findings: WP 5.5.5's own `_wp_sidebars_changed` fatals under PHP 8.2 (`widgets.php:1265`) on `after_switch_theme`, so the swap had to run as `/opt/php7.4/bin/php /usr/local/bin/wp …` — meaning `--skip-themes` had been masking a **core** incompatibility, not only the theme's; and `twentytwentyone` was already installed, so no theme had to be written. A minimal `od-headless` theme (`wp-backend.md` §4.5) stays deferred — nothing needs it yet.

**03 · `od-profile.php` installed, then `cmsms-content-composer` deactivated.** Forced, not optional: with `welfare` gone the plugin fatals on *every* shortcode render, because `cmsms_divpdel()` is defined **in the theme** — so `the_content` over any cmsms body threw `Call to undefined function` and REST 500'd. Deactivating the plugin degrades those bodies to literal shortcode text instead, which is ugly but 200. `wp/mu-plugins/od-profile.php` went up first so `profile` (209 rows) and `pl-categs` survive the loss of their registrar; `project` (21 Lorem drafts) and `content_template` (38) lose theirs as intended. **REST 200 from here on:** 8285 posts / 148 pages / 132 profiles / 17961 media / 110 categories.

**04 · 22 plugins deleted.** Left active: `contact-form-7`, `leyka`, plus the `od-profile` mu-plugin; `wp-downgrade` deactivated but **kept installed** as the re-pin lever. Measured before pruning, not assumed: the only non-cmsms shortcodes in published content are `[owl-carousel]` ×6 and `[pagelist]` ×2, and they sit on `/contacts/`, `/video/`, `/sitemap` and one post — pages Next already serves natively, so the prune costs no visible content. Also removed the dangling `wp-content/advanced-cache.php` that `wp-rocket`'s deletion left behind.

**05 · core 5.5.5 → 7.1** (`--locale=ru_RU`; `core update-db` a no-op at db 61833). Closes **B10**. The pin was real — with `wp-downgrade` active `core check-update` reported "WordPress is at the latest version". Side effect worth keeping: **plain `wp` works again**, no `--skip-plugins`, no `--skip-themes`, under PHP 8.2 CLI. WP 7.1 requires PHP ≥ 7.4 and the vhost serves 7.4.33 — exactly at the floor, see the open list.

**06 · content migrated.** `cmsms-gutenberg-upgrade` uploaded from [`wp/plugins/`](../wp/plugins/cmsms-gutenberg-upgrade/) and activated; `wp cmsms backup` copied **8565** originals into `nvp_content_copy` — that is the per-post rollback (`wp cmsms restore`), and it is why the DB dump grew from 26 MB to 34 MB gzipped. `--dry-run` predicted 5669 changed / 2896 unchanged; the real run matched exactly.

**07 · the good state. B2 closed.** 5393 posts, 144 pages and 132 profiles are core Gutenberg, and rendered REST content carries `is-layout-flex` / `is-layout-constrained` / `is-layout-grid` — so B10's silent-empty-`wp:query` failure mode is gone with it, verified rather than reasoned. Residual `[cmsms_` is **10 occurrences across 10 pages**: `[cmsms_sidebar]` ×8, `[cmsms_selected_products]` ×1, `[cmsms_contact_form]` ×1. The `counter` / `stat` / `quote` / `icon_list` tags that look like gaps in the migrator's 26-tag coverage are **all** inside `content_template`, a dead CPT — as are the other orphans (`product` 6, `leyka_campaign` 3, `campaign` 1, `tribe_*` 4).

**08 · `wp-openapi` installed.** 1.0.29 from wordpress.org, so `/wp-json-openapi` answers — **unauthenticated, 988 KB**, which is what let the type diff below be measured before any application password existed. Note od-dev runs **1.0.21**: any difference the generated types show is that version gap as well as the core one.

**09 · four small fixes, all measured first.** In one snapshot (`09-prep`), because each has a one-command inverse: the nav menu's slug, the footer's widget area, `od-revalidate.php`, and the debug block this prep had added to `wp-config.php`. What each was is in the list below — items 6, 7 and 10.

> **`00-baseline` is a complete un-migrated prod clone** — full tree *including* `welfare` and `cmsms-content-composer`, plus a matching dump. Keep it: it is the cheapest way to rehearse anything that needs prod's original stack (§2.1's mu-plugin idea, for one), and it is a second copy of what the A6 frozen copy will be. It is **not** the frozen copy itself — under §0.4 that is the old prod install, kept running (§5.5).

### Still open on od-stage, in order

1. ~~**The 10 residual pages.**~~ **Closed 2026-08-21 — zero `[cmsms_*]` left on any published page or post.** Six of the ten lost their tag on the way: they are the `/about/reviews/*` family and `od_pages_dead_shortcodes` runs after the entries that rewrite whole bodies. The other four are handled by that rule — a **sweep over every published page**, because the tags are what is addressed and prod may hold one where this list has not looked: `[cmsms_sidebar sidebar="division-list"]` on 526 `news` and 56687 `добровольчество` and `[cmsms_selected_products]` on 28240 `pppuiv-constructor` are dropped (a widget area and a WooCommerce grid, neither of which exists headless), and `[cmsms_contact_form form_cf7="20138{|}…]` on 20139 `ostavit-otziv` becomes **`[contact-form-7 id="20138"]`** — CF7 is one of the two plugins that stay, and the id is read out of the wrapper rather than written into the script. A form tag with no id throws rather than dropping the page's only form. Counted after the run: `publish` pages and posts holding `[cmsms_` — **0**. What is left carries it only in drafts, revisions, trash and the dead CPTs (`content_template` 38, `product` 6, `leyka_campaign` 3–4, `tribe_*` 4), which is the hygiene sweep in item 10, not content.
2. ~~**ACF and the film field group (B3)**~~ **Done 2026-08-20, and the worksheet is applied.** ACF free **6.8.8** installed and activated, then the ops repo's two idempotent scripts run over `wp eval-file -` (§2.2–2.4, no skip flags needed): `setup-film-acf.php` imported `group_film_meta` as post **80414** — 18 fields, `show_in_rest=1` — and `migrate-download-slots.php` was a **no-op**, because the clone holds **zero** `download_full_*`/`download_short_*` rows. That is the expected answer and worth stating: those keys were od-dev's earlier ACF shape, and **prod never had ACF at all**, so there is nothing to fold on a fresh clone. [`od-film-meta.php`](../wp/mu-plugins/od-film-meta.php) is installed as the fourth mu-plugin. **§2.4's gate passes** — all 18 `acf` keys come back, and `meta.od_card_cover` resolves through its fallback branch (no плакат yet, so it serves the featured image), which is what that mu-plugin exists for. §3 then wrote **309 cells across 74 films**: **74 of the 85 catalogue films have a Kinescope player**, share links on 32, a download on 35. Verified as a render, not only as JSON — `/71933/` embeds `kinescope.io/embed/q2ufLsHSSxyYp6teUUke92` and `/19123/` embeds `sNgGnFgYFfAKo7nF3NX5RT`, each the id its row holds.
3. **Application password** — the one thing here that still needs a decision, and it blocks items 6 and 9. `wp-openapi` is installed (step 08) and the **schema gap is already measured**: WP 7.1 adds 14 routes the committed types' source (od-dev, 6.8.8) has never had (`wp-abilities/v1/*`, `wp/v2/icons*`, `wp/v2/media/{id}/sideload`+`finalize`, `wp/v2/view-config`) and lacks three of that install's plugin routes (`author_avatar/blocks/v1*`, CF7's `feedback/schema`). **The types in the repo are generated from od-dev, which is not the source of truth for anything** — regenerating them from the clone once its plugin set is final is the real close-out here, and it needs the pre-pass below; **`pnpm type-check` passes clean against stage-generated types**, so nothing the fetchers touch changed shape across 6.8.8 → 7.1. ~~⚠ But **`pnpm generate:types` fails outright against 7.1**~~ **Fixed and done 2026-08-21: the types in the repo are generated from the clone.** `generate:types` is now `scripts/generate-wp-types.mjs`, which patches the schema before generating — there were **eight** offending nodes, not one, all `view-config` `filters.items.properties.value`, and the rule is narrow enough to state: an empty array that is the direct value of a key inside a `properties` map becomes `{}`, which leaves the document's 39 legal `default: []` alone. It also runs the generator from a scratch directory, because `redocly.yml` otherwise wins over a path argument and silently generates the wrong install, and it runs Prettier itself. `redocly.yml` now points at **od.webtm.ru**. The diff is 3095 insertions / 2578 deletions and **`pnpm type-check`, `pnpm lint` and all 688 tests pass on it**. Also note the schema build logs 56 × `Undefined array key "type"` from `wp-openapi/src/Spec/Operation.php:329` — same malformed node, seen from the other side. ~~**What is left:** the password itself.~~ **Done 2026-08-20**, as a service account, because every one of stage's 7 admins is a real person: `od-frontend` (id **5367**) carries the one application password, named `next-frontend`. ⚠ It was created as an **administrator**, which is far more than the frontend uses — `edit_theme_options` alone covers `/wp/v2/menus`, `/wp/v2/menu-items` and `/wp/v2/widgets`, and nothing else it calls needs a login at all. Move it to the two-capability role in §2.9; an administrator credential is what made drafts readable at `/<id>/` (§2.9). The frontend's copy lives in `.env.stage`, which `.gitignore` already covers via `.env*`, and `node --env-file=.env.stage …` is how every probe below read it without the value passing through a terminal. Revoke with `wp user application-password delete 5367 --all`.
4. ~~**Category ids (B5).**~~ **Closed 2026-08-20 — no code change needed.** Measured on the clone: every id the frontend hardcodes is *identical* to od-dev's, because od-dev is itself a prod clone. `«Видео»` **85** is still the parent, and its children are **581** `movies` «Фильмы» (26 published), **580** `mult` «Мультфильмы» (10), **86** `roliki` «Ролики» (15), **559** `famous` «Известные люди» (36); news is **47** `novosti` «Новости» (7937) and **578** `articles` «Статьи» (19), with `«Видео события»` **52** (115) correctly outside the catalogue. So `filmCategories.ts`, `newsCategories.ts` and `scripts/lib/wp.mjs` all stay as they are. Worth knowing for the next reader: the **slugs differ from our URL segments** (`movies` ≠ `filmy`, `mult` ≠ `multy`, `famous` ≠ `famous-people`) — the config is keyed by URL segment on purpose, so that is not a mismatch to "fix".
5. ~~**Media origin (B6).**~~ **Verified 2026-08-20.** The `.htaccess` rule is one line, `^wp-content/uploads/20(09|1[0-9]|2[0-3])/…` → `https://obshee-delo.website.yandexcloud.net/…` [R=301], which is **exactly** `DEFAULT_WP_MEDIA_CDN` in `src/shared/api/mediaCdn.ts`. Probed both sides: a 2015 upload 301s to the bucket and serves 200 / 174 KB there, a 2026 upload serves 200 locally and is **not** in the bucket (it 301s away) — which is the behaviour `resolveMediaUrl` is built for, since it only prefers the CDN copy when a direct HEAD returns 200.
6. ~~**Menus.**~~ **Probed, and it turned up the one real content trap in this whole prep — fixed 2026-08-20 (step 09).** `/wp/v2/menus` and `/wp/v2/menu-items` are registered and answer `rest_cannot_view` unauthenticated, so reading them still waits on item 3 — but the CLI side is settled, and the names lie. The clone has **three** `nav_menu` terms: **39** `footer-navigation` (38 items), **40** `home` (45), **567** `Регионы` (9). `HeaderServer` fetches `?slug=main-navigation`, which matched **nothing** — the header would have rendered empty. Menu 40 `home` is a decoy: its items are the CMSMasters demo (`Features`, `Shortcodes`, `Post Types`, `News` → `demo.welfare.cmsmasters.net`). The site's real main nav is **39**, despite its slug — `theme_mods_welfare.nav_menu_locations` maps `primary` → **39**, its top level is ГЛАВНАЯ / О НАС / ПРОГРАММЫ / ФИЛЬМЫ / ПРИМИ УЧАСТИЕ / МАТЕРИАЛЫ / КОНТАКТЫ, and [`next-steps.md`](./next-steps.md) had already recorded that ("menu 39, location `primary`, the site's main nav"). od-dev's copy was renamed to `main-navigation` at some point and prod's never was. **Fixed by renaming the term, not the code:** `wp term update nav_menu 39 --slug=main-navigation` — one row, inverse `--slug=footer-navigation`, and it is what `od-wp.php` needs too (`OD_WP_MENU = 'main-navigation'`, item 8). **This is now a required step for any fresh clone.**

   Same shape, second surface: the **footer's widget area went with the theme.** `fetchFooter` reads `?sidebar=sidebar_bottom`, one of the eleven areas `welfare` registered, so deleting the theme moved all 28 widget instances to `wp_inactive_widgets` and the footer would have rendered empty too. The instances survived and so did the assignment — `theme_mods_welfare.sidebars_widgets.data` still records `sidebar_bottom: text-4, text-2, text-3, text-5`, which is «КОНТАКТЫ РЕДАКЦИИ» / «ОТЗЫВЫ» / «ССЫЛКИ» / «МЫ В СОЦСЕТЯХ». Fixed the same way `od-profile.php` fixed the CPTs: [`wp/mu-plugins/od-sidebars.php`](../wp/mu-plugins/od-sidebars.php) re-registers `sidebar_bottom` so the id outlives any theme — **with `welfare`'s own wrappers**, `<aside id="%1$s" class="widget %2$s">` and `<h3 class="widgettitle">`, because `Footer.module.css` lays the footer out with `.footer aside:nth-child(N)` and WordPress's default `<li>` would break it — and the four widgets are assigned back to it. Also a required clone step. (The other areas' widgets stay inactive on purpose; nothing headless reads them.)

   ⚠ **Prod's four widgets are not what the footer was designed against**, and this is where the two installs have to be read differently. They are legacy `widget_text` instances — `<ul><li>` link lists inside `.textwidget` — while `Footer.module.css` is written for **six** widgets in a fixed order (`.footer aside:nth-child(1…6)`: logo+socials · КОНТАКТЫ РЕДАКЦИИ · ОТЗЫВЫ · ССЫЛКИ · separator · legal) carrying core block markup. **The six-widget shape is the sanctioned approach** — it is what [issue #8](https://github.com/Obshee-Delo-IT/od-frontend/issues/8) settled («Футер. Через виджеты») and what the design instance implements. What is *not* sanctioned is that instance's **text**: it is months stale.

   So the clone gets **od-dev's structure with prod's words**, authored on the clone rather than copied from anywhere: six `block` widgets in the slot order above, every fact taken from prod's own four widgets. The text delta is small and worth knowing, because it is what a copy would have lost: prod carries **«Учётный номер в реестре НКО №0012011716»** (under ССЫЛКИ, in a malformed `<ul></li>`) which the design instance never had; prod says «Электронная почта», not «Эл. почта»; and prod's privacy link is the root-relative `/conf_politics/`. Everything else — the Роскомнадзор registration and its PDF, ОГРН 1127799010624, the editor, the phone, both link lists, the three social URLs — is identical on both sides. The НКО number went into the legal row beside ОГРН, where it belongs structurally; the privacy link went to the legal row too, as the design has it. Prod's four `text` widgets stay in the database, parked in `wp_inactive_widgets`, as the record of what the live site said.

   One asset had to come with the structure: the white logo in slot 1. **Prod's media library has no white organisation logo** (only partner logos), so it was uploaded to the clone — attachment **80413**, `2026/08/logo-white.png`. It is chrome rather than editorial content, so the alternative is worth stating: render it in the `Footer` component instead, the way `renderFooterWidget` already replaces the three `cmsms-icon-*` anchors with typed icon components, and the footer stops needing an upload at all.

   (One WP-CLI fact worth keeping: `wp widget move` silently drops `widget_block` instances out of a sidebar, and `wp widget list` does not show them at all — so a sidebar holding block widgets reads as empty. Create them over REST, assign `sidebars_widgets` with `wp eval-file`, and verify over REST.)

7. ~~**`od-revalidate.php` (B4)**~~ **Installed 2026-08-20** at `wp-content/mu-plugins/`, inert as designed: no `OD_REVALIDATE_URL` / `OD_REVALIDATE_SECRET` in `wp-config.php`, so `od_revalidate_enabled()` is false and nothing is posted anywhere. Verified against `debug.log` — the only fatal in it is step 03's historical `cmsms_divpdel()`, nothing from this file. Two defines and a frontend tier are all that is left of §2.5.
8. ~~**Workstream D scripts**~~ **Applied 2026-08-21, both of them, and the order matters: `od-wp.php` first.** It creates the three programme tags a page's `core/query` row reads, and a page cannot query a term that does not exist yet. On the clone it created them, tagged the 14 programme films and set the four плакат urls and 14 cover `alt`s, retitled `/projects/` and `/materials/`, deleted three nav items and retitled `/about/ustav/`, and created the three missing `profile` records with their photographs (80522–80524) — then re-ran reporting `skipped` on every line. `od-pages.php` wrote **308** page and profile bodies on the first pass and **five** more after the fixes below; the third run reports **359 already in shape, 0 writes, 0 warnings**. **Six entries warned first, and every one of them was od-dev's shape rather than production's** — that story is in [`wp-page-redesign.md` §the tests](./wp-page-redesign.md), and the five bodies are now `*.prod.html` fixtures so a regression fails a test rather than a page. One asset had to come with them: `/about/udostoverenie/`'s hero is a crop we made rather than editorial content, so the same 1240×508 file was imported on the clone (attachment **80828**) — and note `wp media import` takes the slug from the `--title`, so it needed `wp post update --post_name=udostoverenie-hero` before the runner could find it.
9. ~~**Frontend smoke**~~ **Done 2026-08-20, and it passes.** Built at `0c6b7d7` in a throwaway `git worktree` — deliberately, so a working tree holding another session's WIP could not contaminate the result — with `WP_BASE` and `SITE_URL` on the stage origin and no `WP_LEGACY_BASE`. `pnpm build` clean; `next start` renders **the header with all 7 root nav items** and the footer with its six `<aside>` widgets in the designed order (item 6). `/`, `/news/`, `/video/`, `/video/filmy/`, `/video/multy/`, `/materials/articles/`, `/about/`, `/sitemap.xml` (1.3 MB), `/robots.txt`, `/health/` all 200; two film pages and two news pages 200 with Gutenberg bodies. Films carry no `acf` object — that is B3, expected.

   **`pnpm url:check --base <local> --top 200`: 98.8 % entry-traffic coverage** (20 649 / 20 907 visits, 193 / 200 URLs). All seven misses are understood and **none is a regression.** Four — `/contacts/`, `/get-involved/`, `/actual/`, `/about/ostavit-otziv/`, 198 visits — are `LEGACY_EMBED_PAGES` entries that 404 only because this smoke had no `WP_LEGACY_BASE`; with A6 wired, coverage is ~99.7 %. The other two are genuine **prod-vs-od-dev content gaps**, worth knowing before someone reads a 404 on the new install as a bug:

   - `/sms/` (46 visits) — page 26936 exists on od-dev and **has never existed on prod**. `https://obshee-delo.ru/sms/` answers **404** today as well, so this is a dead URL that still draws traffic, not something the clone lost.
   - `/profile/efimov-vladimir-valerievich/` and `/profile/nuzhdin-vadim-vladimirovich/` (14 visits) — same ids on both installs (53179, 60854), **`publish` on od-dev, `draft` on prod**. Publishing them on the clone is an editorial call, not a migration step.

10. **Hygiene, last.** ~~the three-line `WP_DEBUG` block~~ **done 2026-08-20** — it and `wp-content/debug.log` are gone, with the pre-edit config kept at `~/backups/09-prep/wp-config.php.pre-debug-removal`; read the log before deleting it, it is what proved item 7 clean. ~~`nvp_content_copy` and the `cmsms_%` meta sweep~~ **done 2026-08-21**, after gate 9 and after workstream D: **215 469 rows** deleted from `wp_postmeta` in batches of 50 000 — `nvp_content_copy` (8472, which is why it waited) plus every `cmsms_%` key except **`cmsms_profile_subtitle`**, whose **193** rows survive because D3 reads the coordinator's region out of them ([`wp-backend.md` §4.4 step 3](./wp-backend.md)). Counted after: 0 and 193. `OPTIMIZE TABLE` did not shrink the file, so the 140 MB stays until the table is rebuilt — rows gone, space not reclaimed.

    ⚠ **Dropping `nvp_content_copy` retires `wp cmsms migrate`, not only `wp cmsms restore`.** The migrator always converts *from* the stored original rather than from the current body — that is what makes it re-runnable after a converter fix ([`wp-page-passthrough.md` §6](./wp-page-passthrough.md)) — so with the meta gone both commands answer `Error: Нет записей с копией оригинала. Сначала запустите \`wp cmsms backup\``, which is what the clone does now, verified. Re-running `backup` does **not** undo that: it would copy the *migrated* Gutenberg body into the meta, so there would be nothing left to migrate from. On the real install this means the sweep is genuinely the last step of the whole procedure, after the frontend gates, and the way back is a dump from `~/backups/`, not a WP-CLI command.

    **Still open: the orphan tables, and one of them is a decision rather than a chore.** `wp_wysija_*` (16 tables) is MailPoet 2, whose plugin is long deleted — but `wp_wysija_user` holds **10 954** subscribers and `wp_wysija_user_list` 11 354 memberships, i.e. a mailing list of real addresses, **still being written to**: 830 arrived in the last year and the newest is dated the day this clone was taken. That is personal data under 152-ФЗ and it is the only copy: **export it before dropping anything**, and decide where the newsletter lives — the new frontend has no working form, so the cutover ends the stream. Full reading and the order of operations in [`next-steps.md`](./next-steps.md). The rest are safe and merely large — `wp_ewwwio_images` (**428 675** rows, an image-optimiser cache), `wp_wpr_rucss_*` (WP Rocket's used-CSS cache), `wp_actionscheduler_*` (WooCommerce's scheduler), `wp_revslider_*` ×7, `wp_layerslider` ×2, `wp_hugeit_lightbox`, `wp_all_in_one_bannerWithPlaylist_*` ×4 — every one of them from a plugin the prune deleted, and none reachable without it. **`wp_leyka_donations` and `wp_leyka_donations_meta` stay**: leyka is still active. There are no `tribe_*` or WooCommerce *tables* left to drop — those were post types, and §0.5 already removed Woo's.
11. ~~**PHP floor.**~~ **Done 2026-08-20** — stage's vhost moved from 7.4.33 to **8.2.32 (`apache2handler`)**, so web and CLI now match and the whole stack is what prod should end up on. Gates re-run clean. **Under §0.4 prod's own PHP stopped being a dependency** — its core is never upgraded, so the 7.4 floor never applies to it. What replaces that concern is the opposite one: the old install has to be **kept** on PHP 7 after cutover, because `welfare` fatals under 8.x and it is what the A6 frozen copy renders (§2.7).
12. **Decisions this prep deliberately did not take.** Whether `leyka` stays on this WP or moves to `помоги.общее-дело.рф`; whether prod's REST goes public or gets path-allowlisted (§2.1's warning still stands — stage is not the same risk); whether `contact-form-7` 5.4.2 is updated or dropped for the Next form (it throws PHP 8.2 deprecations on every load today, as does `leyka` 3.30.3); what happens to MailPoet's 10 954 subscribers, and whether this site keeps a newsletter at all (item 10); and the editorial calls workstream D's run surfaced — **19 catalogue films that are `draft` on production though published on od-dev**, four more that are plain news posts there, and `19894` «День рожденья», a published film with no catalogue category (§3.3).

---

## 0.7 Traps — symptom first

**Read this section on the day, not the prose.** Every row below is something
that actually happened on od-dev or on the prod clone, and almost all of them
**answer 200, or exit 0, while being wrong** — which is why they cost hours the
first time. The columns are what you *see*, what it *is*, and what to do; the
detail is in the section named. Ordered by when in the procedure it bites.

### On the WordPress side

| you see | it is | do |
| --- | --- | --- |
| WP-CLI output interleaved with `Deprecated:` walls | CF7 5.4.2 and leyka 3.30.3 under PHP 8.2 CLI. Not an error, but it corrupts `--format=csv` and hides the real line | run WP-CLI as `php -d display_errors=0 -d error_reporting=0 /usr/local/bin/wp …` (§1) |
| WP-CLI aborts with a redirect backtrace | `clearfy-pro` sees an empty host and 301s to `https://` | `--url=https://<host>` on **every** command, or `--skip-plugins=clearfy-pro` (§1) |
| any WP-CLI command that loads WordPress fatals | timeweb's CLI PHP is 8.2 and `welfare` dies there | `--skip-themes`, or the site's own binary `/opt/php7.4/bin/php /usr/local/bin/wp …` (§1) |
| `wp theme activate` fatals in `widgets.php:1265` | **core** 5.5.5, not the theme — `_wp_sidebars_changed` under PHP 8.2 on `after_switch_theme`. `--skip-themes` was masking a core bug | run that one command under PHP 7.4 (§0.6 step 02) |
| REST still 404s after `clearfy-pro` is off | there are **two** switches, and the theme's is in code with no option behind it — `remove_action('parse_request','rest_api_loaded')` in `welfare/functions.php` | delete the theme on the clone; on a live install use the mu-plugin sketch (§2.1) |
| REST 500s on every post after the theme is gone | `cmsms_divpdel()` is defined **in the theme**, so `the_content` over any cmsms body throws | deactivate `cmsms-content-composer` in the same window — it is forced, not tidying (§0.6 step 03) |
| `profile` records vanish from REST | their post type was registered by the plugin you just switched off | [`od-profile.php`](../wp/mu-plugins/od-profile.php) goes up **first**, at `init` priority 20 (§2.6) |
| the migrator's `wp:query` blocks render as an empty `<div>`, at 200 | WordPress 5.5.5 does not know the block | core update **before** the migration, never after (§2 order, row 3) |
| **the header renders empty** | `HeaderServer` looks up the nav by slug `main-navigation`; production's menu 39 is called `footer-navigation` and the name lies — menu 40 `home` is the CMSMasters demo | `wp term update nav_menu 39 --slug=main-navigation` (§0.6 item 6) |
| **the footer renders empty** | `fetchFooter` asks for `sidebar=sidebar_bottom`, one of eleven areas the deleted theme registered; its widgets went to `wp_inactive_widgets` | [`od-sidebars.php`](../wp/mu-plugins/od-sidebars.php) re-registers the id **with `welfare`'s wrappers** — `Footer.module.css` lays the footer out by `aside:nth-child(N)` (§0.6 item 6) |
| `wp widget list` shows an empty sidebar you just filled | WP-CLI does not understand `widget_block` instances at all, and `wp widget move` silently drops them into `wp_inactive_widgets` | create them over REST, assign `sidebars_widgets` with `wp eval-file`, verify over REST (§0.6 item 6) |
| the footer's columns are in the wrong order | `wp widget move` **prepends** | `--position=N` |
| `/contacts/` shows no regions | the accordion transform found no `wp:details` — production never had od-dev's 50 hand-made spoilers | it now falls back to the dead `[pagelist]`, then to the map (§0.6 item 8) |
| a `wp eval-file` transform warns «unexpected input» and the page is untouched, at 200 | the transform was written against od-dev's shape | five known cases, all now read both shapes; a sixth means recapture the body as a `*.prod.html` fixture ([`wp-page-redesign.md`](./wp-page-redesign.md)) |
| a page transform reports «no such page» | `od-pages.php` addresses records **by path**; production's page set is not od-dev's (148 published against 168) | check the path exists before assuming the transform is broken ([`page-inventory.md` §1a](./page-inventory.md)) |
| the runner cannot find an attachment it needs | `wp media import` takes the slug from `--title`, not from the filename, so a Cyrillic title gives a Cyrillic slug | `wp post update <id> --post_name=<slug>` after the import (§0.6 item 8) |
| a query block on a programme page lists nothing | its term did not exist when the page was written | **`od-wp.php` before `od-pages.php`**, always (§0.6 item 8) |
| ACF fields are missing from `/wp/v2/posts?format=video` | the field group was never imported, or `show_in_rest` is off | `setup-film-acf.php` (§2.2–2.4); the gate is 18 keys **and** `meta.od_card_cover` |
| a programme card has no cover | `od_card_cover` is a *registered* meta key, and ACF's own fields are not registered | [`od-film-meta.php`](../wp/mu-plugins/od-film-meta.php) must be installed (§2.4) |
| `pnpm film:export` writes an empty worksheet | `scripts/lib/wp.mjs` keeps its **own** copy of the film category ids | fix it during §1.3, not at §4.3 |
| the worksheet has rows for films the target has none of | the exporter scopes to `publish` and to the four catalogue categories; production keeps **19** of those films as drafts | editorial, not a bug — the list is §3.3 |
| `wp db query` says `Table 'wp_…' doesn't exist` | the prefix is `wp_`, and `nvp_content_copy` is a **meta key**, not a table | `wp db prefix` first |
| `/wp/v2/profile` loses its region field after the meta sweep | `cmsms_profile_subtitle` was deleted with its siblings | the sweep must exclude it — 193 rows ([`wp-backend.md` §4.4 step 8](./wp-backend.md)) |

### On the frontend side

| you see | it is | do |
| --- | --- | --- |
| `pnpm generate:types` refuses the document | WP 7.1's `view-config` declares **eight** properties as `[]` where a schema object belongs | `scripts/generate-wp-types.mjs` patches them; do not hand-edit the output (§0.6 item 3) |
| the generated types describe the wrong install | `redocly.yml` wins over any path or URL argument, silently | the wrapper runs the generator from a scratch directory; use `-- --from <url>` to repoint |
| `pnpm map:generate` throws «href matches no published page» | production's region page for that code is in the trash — 57 region pages against od-dev's 75 | an alias with no page now greys its region; a *matched* page that vanished is still fatal (§0.6 item 8) |
| a category page answers 200 with everything, or with nothing | a redirect or a config id points at a filter value the destination does not recognise. **Status cannot catch this** | compare the card count against WP (§5 gates 1–2, 7) |
| `/health` is a 308 | `trailingSlash: true` | probe `/health/` (§4.6) |
| **the container exits on start**, `Cannot find module '/app/server.js'` | `pnpm-workspace.yaml` makes Next trace from the workspace root, so the standalone output nests one level deep | `outputFileTracingRoot` is pinned in `next.config.ts`; do not remove it (§4.5) |
| **every prerendered page has an empty header and footer**, `x-nextjs-cache: HIT` | the image was built without WP credentials, so `httpClient` used its stub and the root layout's fetches returned nothing — baked into the HTML for the whole hour of `revalidate` | `WP_USER`/`WP_PASSWORD` are needed at build too, as **BuildKit secrets** — never build args, see §4.7 (§4.5, §4.7) |
| `getaddrinfo EAI_AGAIN` part way through the prerender | musl does not retry and does not cache; the prerender makes hundreds of requests from four workers | the base image is `node:22.16.0-slim`, not Alpine (§4.5) |
| every `next/image` request 400s on the deployed site | `WP_BASE` was not a build arg, so `images.remotePatterns` was built against `https://wp.invalid` | pass all five build args (§4.7) |
| the deploy advertises production's URLs from a non-prod tier | `SITE_URL` defaults to `https://obshee-delo.ru` | set it explicitly on every tier — it feeds `metadataBase`, every canonical, the sitemap and `robots.txt` (§4.1) |
| the legacy fallback 404s fleet-wide | `WP_LEGACY_BASE` unset, or the container has no egress to it | boot logs say which — every line starts `[legacy] ` (§5 gate 12) |
| the legacy fallback embeds the site inside itself | after cutover `WP_LEGACY_BASE` is this deployment's own origin | it must be the frozen copy; the app warns but does not stop (§5.5) |
| legacy pages send visitors to live production | the frozen copy still emits `obshee-delo.ru` links, and the transform rewrites by comparing against the origin it fetched from | clone it with the usual domain search-replace (§4.1) |
| a legacy page shows the old chrome | the transform found no `section#middle`, or unbalanced markup | `[legacy] boundary miss` / `unbalanced` in the logs; `pnpm legacy:sweep` over all 172 |
| editors publish and nothing changes for an hour | `REVALIDATE_SECRET` or `OD_REVALIDATE_URL` is unset. One WP install notifies **one** frontend | §4.8, and [`wp-backend.md` §6.5](./wp-backend.md) |
| a style is right in `next dev` and wrong in `next start` | source order — `@radix-ui/themes` CSS must be imported at the top of `app/layout.tsx`, not behind a component | never move those imports; compare `dev` against `start` (CLAUDE.md, C12) |
| the certificate does not cover the apex | a wildcard matches **one** label and not the bare domain | get apex + `www` on the vhost **before** the DNS change (§5.5) |
| the frozen copy fatals | `welfare` under PHP 8.x | leave that install on **PHP 7** forever (§2.7, §5.5) |
| **every legacy page renders the frozen copy's home page**, at 200 | a blanket `frozen/* → frozen/` 301: the loader follows same-origin redirects | never 301 the frozen copy — close it with `Require ip` instead (§5.6) |
| the legacy fallback 404s fleet-wide *after* it worked | the frontend VPS's outbound IP changed and `Require ip` no longer matches it | re-read the IP from inside the container and update the frozen copy's `.htaccess` (§5.6) |
| in-article images from 2024 onward break for visitors | `wp.obshee-delo.ru` was given the frozen copy's IP allowlist; those uploads have no bucket copy and are fetched by the **browser** | `noindex` only on the WordPress host, never an allowlist (§5.6) |
| the new WordPress host ranks against the apex | no `X-Robots-Tag` on `wp.obshee-delo.ru` — it is a full crawlable second copy of the content | set the header at cutover and verify with `curl -sI` (§5.6) |
| `X-Robots-Tag: noindex` is set and the host is indexed anyway | a `robots.txt` `Disallow` (the crawler never sees the header), or a plugin's own `<meta name="robots">` — Yandex takes the *permissive* value when two directives disagree | never pair `Disallow` with `noindex`; grep the HTML for the meta tag as well as the header (§5.6) |
| the frontend goes blind on every WP request, 401 | HTTP Basic was added to `wp.obshee-delo.ru`; Apache validates the same `Authorization` header the application password travels in | never Basic on that host — IP plus session cookie instead (§5.6) |
| editors cannot save in the block editor although they are logged in | same cause: WordPress reads the Apache Basic credentials as an application password, fails, and answers REST 401 | as above (§5.6) |

---

## 1. Recon — read-only, do this before touching anything

**On stage this no longer applies** — since §0.6 plain `wp --path=~/od-stage/public_html <command>` works, because the theme and clearfy are both gone and core is 7.1. Keep reading for **prod**, and for re-running §1 against a fresh clone.

On an un-prepped prod clone, use the alias and **both** skip flags. Without `--skip-plugins=clearfy-pro` the output is corrupted by a redirect warning; without `--skip-themes` any command that loads WordPress fatals, because timeweb's CLI PHP is 8.2 and prod's `welfare` theme dies there (`functions.php:754`) exactly as it does on prod — see [`wp-backend.md` §2](./wp-backend.md#2-stack-on-od-dev). When a command genuinely needs the theme loaded, run WP-CLI under the site's own PHP instead: `/opt/php7.4/bin/php /usr/local/bin/wp …`. §0.6 found that `--skip-themes` was hiding more than the theme: WP 5.5.5's own `_wp_sidebars_changed` fatals under PHP 8.2, so anything that fires `after_switch_theme` needs the 7.4 binary, not the flag.

```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes core version'
```

**On a prepped install, this is the invocation to use for everything** — the flags are gone but two `-d` switches are not cosmetic. `contact-form-7` 5.4.2 and `leyka` 3.30.3 throw PHP 8.2 deprecations on every load, which interleave with WP-CLI's own stdout: `--format=csv` output becomes unparseable and a real error scrolls past unread.

```bash
W='php -d display_errors=0 -d error_reporting=0 /usr/local/bin/wp --path=$HOME/od-stage/public_html'
ssh timeweb "$W post list --post_type=page --format=csv"
ssh timeweb "$W eval-file ~/od-stage/od-pages.php --url=https://od.webtm.ru"   # dry run
```

Keep `--url=` even where it is not strictly needed: it costs nothing and it is required the moment `clearfy-pro` is in play (§0.7).

**1.1 REST reachability.** From your machine, not the server:
```bash
curl -sI https://od.webtm.ru/wp-json/wp/v2/posts | head -3   # expect 200, not 301/302 to /
```

**1.2 Plugins + whether ACF is already there.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes plugin list --status=active --fields=name,version --format=csv'
```

**1.3 Taxonomy ids — do not assume they match od-dev.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes term list category --fields=term_id,slug,name,parent,count --format=csv | grep -E "video|movies|mult|roliki|famous|actual|novosti|articles"'
```
Expected on od-dev: parent «Видео» `85`; children Фильмы `581`, Мультфильмы `580`, Ролики `86`, Известные люди `559`; sibling «Видео события» `52`. **Also the two news ids** — Новости `47`, Статьи `578` (count 19) — which drive the `/news/` chips and `/materials/articles/`. **Record the real numbers and their counts** — §4.3 needs the ids, and §5 gates 1–2 and 7 compare against the counts.

**1.4 Film body format — the B2 check.** This decides how much of the film page survives:
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes post list --post_type=post --format=csv --fields=ID --posts_per_page=5 \
  --tax_query='"'"'[{"taxonomy":"post_format","field":"slug","terms":"post-format-video"}]'"'"' '
# then, for one of those ids:
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes post get <ID> --field=post_content | grep -c "cmsms_\|wp:"'
```
- **Gutenberg (`wp:` blocks)** → the film page renders exactly as on od-dev. Proceed.
- **`[cmsms_*]` shortcodes** → the *body* renders as shortcode soup, but **the hero, download pills, share tiles, trailer and poster card all come from ACF**, which §3 populates. The realistic mitigation is to let the body degrade (or hide it) rather than to build a shortcode parser. **Raise this with Alexey before proceeding — it changes what the page looks like, not whether it works.**

**1.5 Media origin.**
```bash
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes option get upload_url_path'
ssh timeweb 'cd ~/od-stage/public_html && wp --skip-plugins=clearfy-pro --skip-themes plugin list --format=csv | grep -i "offload\|s3\|yandex\|cloud"'
```

**1.6 Film inventory baseline** — so §5 has something to compare against:
```bash
curl -s "https://od.webtm.ru/wp-json/wp/v2/posts?format=video&per_page=1" -o /dev/null -D - | grep -i x-wp-total
```
od-dev: 203 `format=video` posts, 99 in the four film sub-categories.

---

## 2. WordPress preparation

> **Read the order before the steps.** The numbering below is historical — other docs link to §2.1, §2.5, §2.6 and §2.8 by number, so they keep them. The **execution order is not the numbering**, and the whole rehearsal on od-stage (§0.6, 2026-08-20/21) is what settled it. This table is the master checklist: nineteen steps, and the ones that are not obvious are not obvious for a reason given in the right-hand column.
>
> | # | do this | why here |
> |---|---|---|
> | 1 | Clone live prod into the new install | The source, and the point of no return for *this* copy — but prod itself is untouched, so a bad prep is answered by cloning again. The A6 frozen copy needs no capture step under §0.4: it is the old install, kept as it is. |
> | 2 | `wp cmsms backup` | Free, and it is the per-post rollback for everything after it — **and the source `migrate` converts from**, so it is also what makes a re-run possible. Both die with the meta; see item 10 of §0.6. |
> | 3 | Core upgrade (**§2.7** first half) | Must precede the conversion — 5.5.5 renders the migrator's `wp:query` as an empty div, at 200. |
> | 4 | `wp cmsms migrate` (**§2.7** second half) | Needs the shortcode text still present, nothing else; the migrator is pure regex over raw `post_content` and does not need cmsms loaded. |
> | 5 | `od-profile.php` (**§2.6** steps 2–3) | Installed while cmsms is still active, so it can be verified before anything is switched off. |
> | 6 | Open REST (**§2.1**) | On prod this is where the paths fork — see §2.1. On a clone it is the theme deletion, and that is what forces step 7 immediately. |
> | 7 | cmsms off and deleted (**§2.6** step 4) | **Forced, not tidying,** if step 6 removed the theme: `cmsms_divpdel()` lives in `welfare`, so with the theme gone every shortcode render throws `Call to undefined function` and REST 500s. |
> | 8 | Plugin prune ([`wp-backend.md` §4.3](./wp-backend.md)) | After the conversion, so a plugin whose shortcodes are still in a body is measured before it is dropped, not after. |
> | 9 | Re-register what the theme owned, and author the footer (**§0.6** item 6) | `wp term update nav_menu 39 --slug=main-navigation`, [`od-sidebars.php`](../wp/mu-plugins/od-sidebars.php) with `welfare`'s wrappers, then the six `sidebar_bottom` block widgets — the design's structure, prod's texts — created over REST and assigned by writing the option directly. **Not optional and easy to miss:** without them the header and the footer both render *empty*, at 200, because the frontend looks up the nav by a slug only od-dev carries and the footer by a widget area only `welfare` registered. |
> | 10 | An **application password** for the frontend, on a service account | Everything below reads REST as the frontend does. Every admin on this install is a real person, so `od-frontend` is a user of its own — on a role of `read` + `edit_theme_options` and nothing more (§2.9), which is exactly what `/wp/v2/menus`, `/wp/v2/menu-items` and `/wp/v2/widgets` require. |
> | 11 | `wp-openapi`, then `pnpm generate:types -- --from https://<new host>/wp-json-openapi` | The types must describe the install that is about to serve. The schema needs patching on WP 7.1 and the wrapper does it (§0.6 item 3). |
> | 12 | ACF and the film group (**§2.2–2.4**), then [`od-film-meta.php`](../wp/mu-plugins/od-film-meta.php) | Independent of all of the above. The mu-plugin is not optional: a programme card's cover is a *registered* meta key and ACF's fields are not registered. |
> | 13 | Film data (**§3**) — export, remap onto this install's ids, import; then `film:kinescope`, then `film:covers` | Needs the field group (step 12) and nothing else. Remap by title, never by id: ids are per-install. |
> | 14 | [`od-regions.php`](../wp/mu-plugins/od-regions.php), then **`od-wp.php`**, then **`od-pages.php`** (**§2.8**) | Three things in one row because the order inside it matters. The shortcode has to exist before `/contacts/` is rewritten to use it; `od-wp.php` creates the terms `od-pages.php`'s query blocks read, and a page cannot query a term that is not there yet. Run `od-pages.php` a third time and expect `0 writes, 0 warnings`. |
> | 15 | `pnpm map:generate` and `pnpm pages:inventory`, **against the new install** | Both are generated from what WordPress actually holds. The map refuses to emit a link no page answers for, and production's region page set is not od-dev's — 57 against 75. |
> | 16 | `od-revalidate.php` (**§2.5**), inert | Wants the final content in place, and its two defines are deploy-time config (§4.8). |
> | 17 | Hygiene (**§0.6** item 10) | Last on the WordPress side, and **after** every gate: `nvp_content_copy` *is* the migration rollback. The orphan tables wait on one export — see [`next-steps.md`](./next-steps.md). |
> | 18 | Build the image with **five** build args, deploy, run **§5** | Two of the five are secrets and the image is wrong without them (§4.5). |
> | 19 | Cutover (**§5.5**) | The first step the public sees, and the only one whose rollback is a DNS record. |
>
> **This runs against the new install, never against live prod (§0.4).** Which is what makes it one procedure: nobody is reading the target, so the window between steps 6 and 7 — bodies rendering as literal `[cmsms_…]` text under a stock theme — costs nothing, exactly as it cost nothing on od-stage. Steps 1 and 2 are the ones with no second chance; the rest are re-runnable on a fresh clone, which is how §0.4 proposes to close the content gap.


**2.1 Enable REST (B1). There are two switches, and the one this step was written about is the lesser of them.** Established on od-stage 2026-08-20 (§0.6): deactivating `clearfy-pro` left REST answering **404**.

**Switch A — `clearfy-pro`, an option.** The key `disable_json_rest_api` inside the `clearfy_option` array; `'on'` → unset/`''`. **No admin UI needed**, which is what unblocked this: WP-CLI over `ssh od-root` can flip it (read on BeGet 2026-08-15, still `'on'`), and the F6 pass already used that mechanism on a different clearfy option.

**Switch B — the `welfare` theme, in code, with no option behind it.** `functions.php:729–748`, under the comment `// Отключаем сам REST API`:

```php
add_filter('rest_enabled', '__return_false');
remove_action( 'init', 'rest_api_init' );
remove_action( 'rest_api_init', 'rest_api_default_filters', 10, 1 );
remove_action( 'parse_request', 'rest_api_loaded' );          // ← this is the one that 404s
remove_filter( 'rest_authentication_errors', 'rest_cookie_check_errors', 100 );
remove_action( 'rest_api_init', 'wp_oembed_register_route' );
// … plus rest_output_rsd / rest_output_link_wp_head / rest_output_link_header
// and the five auth_cookie_* rest_cookie_collect_status hooks
```

`remove_action('parse_request', 'rest_api_loaded')` is the decisive line — without it `/wp-json/*` never routes, whatever clearfy says. `rest_enabled` has been a no-op since 4.7 and is a red herring.

**Lifting switch B: delete the theme.** `wp theme activate twentytwentyone && wp theme delete welfare` — what od-stage did, and under §0.4 there is nothing to weigh it against, because the install nobody is reading yet does not need `welfare` to render anything. It retires switch B permanently and it **forces §2.6 step 4 in the same window** (see the order table above), leaving bodies as literal shortcode text until the conversion lands.

> Two subtler ways to lift switch B were worked out while this looked like an in-place change to a live site — commenting the block out of `functions.php`, or an mu-plugin re-adding the removed hooks at `after_setup_theme` (which fires *after* the theme's `functions.php` is included, so it would win). **Neither is needed now.** Recorded here only so nobody re-derives them: if a live install ever has to keep `welfare` *and* answer REST, the mu-plugin is the one to build, since it rolls back with `rm`.

Re-run §1.1 to confirm, and check **both** switches are off before concluding the endpoint is closed for a reason.

⚠️ **This one is a decision, not a chore** — it opens prod's REST surface to the public internet, so it wants a deliberate go-ahead rather than being flipped in passing. If REST must stay closed to the public, allowlist by path rather than disabling wholesale; the app needs `wp/v2/posts`, `wp/v2/media`, `wp/v2/menus`, `wp/v2/menu-items`.

> Basic auth also requires the **application password** to exist on the target env — generate one per environment ([WP guide](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)) and never reuse od-dev's.

**2.2 Install ACF free (B3).** Done on od-stage 2026-08-20 — version **6.8.8**. Plain `wp` works there since §0.6 step 05, so the skip flags are gone; the `-d` flags only silence CF7 5.4.2 / leyka 3.30.3's PHP 8.2 deprecations, which otherwise interleave with WP-CLI's own output.
```bash
ssh timeweb 'php -d display_errors=0 -d error_reporting=0 /usr/local/bin/wp \
  --path=$HOME/od-stage/public_html plugin install advanced-custom-fields \
  --activate --url=https://od.webtm.ru'
```

**2.3 Create the field group, then migrate legacy download meta.** Both scripts live in the ops repo at `servers-agent/tasks/2026-06-04-od-dev-film-acf-recon/` and are idempotent. **Order matters, and only these two:**
```bash
cd ~/Projects/servers-agent/tasks/2026-06-04-od-dev-film-acf-recon
W='php -d display_errors=0 -d error_reporting=0 /usr/local/bin/wp --path=$HOME/od-stage/public_html'
ssh timeweb "$W eval-file - --url=https://od.webtm.ru" < setup-film-acf.php
ssh timeweb "$W eval-file - --url=https://od.webtm.ru" < migrate-download-slots.php
```
Ran 2026-08-20: `OK: imported 'group_film_meta' (ID 80414) with 18 fields, show_in_rest=1`, then `DONE: 0 posts migrated`.
- `setup-film-acf.php` — 18 flat url/text fields, `show_in_rest`, location `post_format == video`. Safe to re-run: same field keys ⇒ existing postmeta survives.
- `migrate-download-slots.php` — folds any legacy `download_full_*`/`download_short_*` meta into `download_{1..5}_{url,label}` with composed labels.
- ⚠️ **Do NOT run `apply-film-downloads.php`** — retired 2026-07-03; it writes the old field keys.

**2.4 Gate.** REST must return all 18 keys. Passed on od-stage 2026-08-20, and check `meta.od_card_cover` in the same breath — that is [`od-film-meta.php`](../wp/mu-plugins/od-film-meta.php), which has to be installed for a programme card to have a cover:
```bash
curl -s -u "$WP_USER:$WP_PASSWORD" "https://od.webtm.ru/wp-json/wp/v2/posts?format=video&per_page=1&_fields=acf" | head -c 600
```

**2.5 Install the revalidation mu-plugin (B4).** Without it an editor publishes and then waits out the hour; with it the page is gone from the cache before they can reload. Source and full reference: [`wp/mu-plugins/od-revalidate.php`](../wp/mu-plugins/od-revalidate.php) and [`wp-backend.md` §6.5](./wp-backend.md). It was installed and tested on od-dev on 2026-08-13; **prod differs in four ways that matter.**

- **Prod is WordPress 5.5.5** (pinned by an active `wp-downgrade`) and its site PHP is **7.x** — `.htaccess` carries an `<IfModule mod_php7.c>` block, while the *CLI* php is 8.2. The plugin is written for that floor on purpose: it hooks `transition_post_status` because **`wp_after_insert_post` does not exist before WP 5.6** and would silently never fire here, and it uses no typed properties, no `str_starts_with` and no `void` returns, because 7.4+ syntax is a **parse error that takes the whole site down** the moment a mu-plugin loads. Don't modernise it, and re-read this line before editing it.
- **The path is `~/public_html/`** — not `~/obshee-delo.ru/` — and every WP-CLI call there needs `--skip-plugins --skip-themes` (§2 of `wp-backend.md`). Verified: a bare `--skip-plugins` skips *regular* plugins only, so the mu-plugin still loads and the checks below work.
- **`wp-content/mu-plugins/` does not exist on prod yet**; it has to be created, as it did on od-dev.
- **No php-fpm.** Prod is Apache mod_php, so `fastcgi_finish_request()` is unavailable and the 5-minute breaker is the only thing standing between a dead frontend and a 5 s penalty on every save. On od-dev that measured 6630 ms for the first save, then 795–1765 ms. Prod carries 25 active plugins and is slower to begin with — budget accordingly, and if editors ever report slow saves, `grep -F "[od-revalidate]" wp-content/debug.log` is the first place to look.

Egress is fine: `wp_remote_get('https://example.com/')` from prod answered **200 in 0.25 s** (checked 2026-08-13), and no `WP_HTTP_BLOCK_EXTERNAL` is defined.

```bash
# 1. Upload, into a directory that does not exist yet
ssh od-root 'mkdir -p ~/public_html/wp-content/mu-plugins/od-revalidate'
scp wp/mu-plugins/od-revalidate.php od-root:public_html/wp-content/mu-plugins/od-revalidate.php
ssh od-root 'chmod 600 ~/public_html/wp-content/mu-plugins/od-revalidate.php && php -l ~/public_html/wp-content/mu-plugins/od-revalidate.php'

# 2. Config, secret over stdin so it never reaches a command line or a shell
#    history. Install it INERT first — URL commented out, secret in place — so
#    the file is in prod before cutover without doing anything.
S=$(openssl rand -hex 32)   # prod's own secret; never stage's, never od-dev's
printf '<?php\ndefined( '"'"'ABSPATH'"'"' ) || exit;\n// defined( '"'"'OD_REVALIDATE_URL'"'"' ) || define( '"'"'OD_REVALIDATE_URL'"'"', '"'"'https://obshee-delo.ru/api/revalidate/'"'"' );\ndefined( '"'"'OD_REVALIDATE_SECRET'"'"' ) || define( '"'"'OD_REVALIDATE_SECRET'"'"', '"'"'%s'"'"' );\n' "$S" \
  | ssh od-root 'T=~/public_html/wp-content/mu-plugins/od-revalidate/config.php; cat > $T && chmod 600 $T && php -l $T'
# …and put the same $S into the deployment's REVALIDATE_SECRET (§4.1).

# 3. Loaded, and inert as intended?
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
  var_dump( class_exists( \"OD_Revalidate\" ), OD_Revalidate::configured() );"'   # true, false
```

**At cutover**, once the frontend is deployed and holds the matching secret, uncomment `OD_REVALIDATE_URL` and verify in this order — **do not test by publishing something on the live site**:

```bash
# a. the two secrets are the same one — compare digests, never values
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "echo hash( \"sha256\", OD_REVALIDATE_SECRET );"'
node --env-file=.env -e "console.log(require('node:crypto').createHash('sha256').update(process.env.REVALIDATE_SECRET).digest('hex'))"

# b. a purge by hand: expects bool(true), and the frontend answers 200
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
  var_dump( OD_Revalidate::send( array( \"tags\" => array( \"wp:menus\" ) ) ) );"'

# c. only then, a real edit — retitle a post to the same title and watch
#    x-nextjs-cache on its page go HIT → MISS
```

**Rollback is deletion.** `rm ~/public_html/wp-content/mu-plugins/od-revalidate.php` and the `od-revalidate/` directory beside it; nothing else in WordPress references either, and the only DB row it can leave is one transient (`wp --skip-plugins --skip-themes transient delete od_revalidate_unreachable`). Deleting the config alone is enough to make it inert.

**2.6 Take the `profile` post type off cmsms, then deactivate it (B8a).** Done on od-dev 2026-08-18; on prod it is three steps in a **fixed order**, because each one is what makes the next safe.

**The order is the whole instruction.** Prod's content is still CMSMasters shortcodes, so the plugin that renders them has to outlive the conversion:

⚠️ **Unless the theme goes first, in which case cmsms cannot outlive anything.** Measured on od-stage 2026-08-20: `cmsms_divpdel()` is defined in **`welfare`**, not in the plugin, so with the theme deleted every `the_content` over a cmsms body throws `Call to undefined function cmsms_divpdel()` at `cmsms-content-composer/inc/shortcodes.php:222` — and REST 500s on the first `content.rendered` it tries. Deactivating the plugin is then not a choice but the fix: with no shortcode handler registered the bodies degrade to literal `[cmsms_…]` text, which is ugly and answers 200. **This is why the order table above puts the theme deletion and the cmsms deactivation in the same window.** On a target nobody is reading yet (§0.4) that window is free; it was the reason the in-place version of this plan could not delete the theme at all.

1. **Convert the content first** — the `wp cmsms migrate` pass this runbook already schedules. A shortcode whose plugin is gone renders as its own source text, so anything unconverted becomes visible bracket soup. od-dev needed four extra branches for `[cmsms_table]`, `[cmsms_audios]`, `[cmsms_tabs]` and `[cmsms_slider]`, which are now in the migrator — re-check after the pass with:
   ```bash
   ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
     global \$wpdb;
     foreach ( \$wpdb->get_results( \"SELECT post_type, COUNT(*) n FROM \$wpdb->posts WHERE post_status = '\''publish'\'' AND post_content REGEXP '\''\\\\\\\\[cmsms'\'' GROUP BY post_type\" ) as \$r ) {
       printf( \"%s=%d \", \$r->post_type, \$r->n );
     }"'
   ```
   `page` and `post` must be **0** or the remaining paths must all be on the A6 iframe list. Post types with no route here (`product`, `leyka_campaign`, `campaign`, `tribe_*`, `content_template`) don't matter.

   **What that query returned on the prod clone, after the pass:** `page=10`, `post=0`, plus the routeless types. So `post` reaches zero and `page` does not — the ten are listed in §0.6's open list, and every tag left on them (`[cmsms_sidebar]`, `[cmsms_selected_products]`, `[cmsms_contact_form]`) is one the redesign has no use for. Worth knowing before the pass: the migrator's coverage looks thinner than it is. It handles 26 tags, and the ones it doesn't — `counter`, `stat`, `quote`, `icon_list`, `dropcap`, `twitter` — appear **only** inside `content_template`, cmsms's own CPT, which loses its registration with the plugin.

   Note also that this step does not need cmsms *loaded*, only its shortcode text present: `welfare_to_gutenberg()` is `preg_replace_callback` over the raw `post_content` read back out of `nvp_content_copy`. A deactivated — even deleted — cmsms converts identically.
2. **First dump prod's own registration and diff it against the file.** The
   arguments in `od-profile.php` were dumped from **od-dev**, where cmsms runs
   under WP 6.8.8; prod is a different cmsms release under 5.5.5, and a
   difference in `rewrite.slug` or `has_archive` would silently move 205 URLs the
   moment our file wins. Read it before installing anything:
   ```bash
   ssh od-root 'cd ~/public_html && wp --skip-plugins=wp-downgrade --skip-themes eval "
     \$p = get_post_type_object( \"profile\" );
     var_export( array(
       \"rewrite\"     => \$p->rewrite,
       \"has_archive\" => \$p->has_archive,
       \"supports\"    => array_keys( get_all_post_type_supports( \"profile\" ) ),
       \"taxonomies\"  => get_object_taxonomies( \"profile\" ),
     ) );"'
   ```
   Expect `slug => profile`, `with_front => true`, `has_archive => true`, the ten
   supports and `post_tag` + `pl-categs`. **Anything else is a stop** — edit the
   mu-plugin to match prod before continuing, and note why in its header.
3. **Then install the mu-plugin**, while cmsms is still active — it hooks `init` at priority 20 precisely so it takes over immediately and can be verified before anything is switched off:
   ```bash
   scp wp/mu-plugins/od-profile.php od-root:public_html/wp-content/mu-plugins/od-profile.php
   ssh od-root 'chmod 600 ~/public_html/wp-content/mu-plugins/od-profile.php && php -l ~/public_html/wp-content/mu-plugins/od-profile.php'
   ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval "
     \$p = get_post_type_object( \"profile\" ); \$t = get_taxonomy( \"pl-categs\" );
     printf( \"%s | %s | tax_rest=%s | meta_rest=%s\n\", \$p->labels->name, \$t->labels->name,
       var_export( \$t->show_in_rest, true ),
       var_export( get_registered_meta_keys( \"post\", \"profile\" )[\"cmsms_profile_subtitle\"][\"show_in_rest\"] ?? null, true ) );"'
   ```
   Expect `Профили | Регионы | tax_rest=true | meta_rest=true`. Russian labels are the tell that our file, not cmsms, is the live registration.
4. **Then deactivate, delete, and flush.** `wp plugin deactivate cmsms-content-composer`, then `wp plugin delete cmsms-content-composer`, then `wp rewrite flush` — same slugs, so the rules come back identical, but the flush costs nothing and a stale rule set is a 404 on every `/profile/…`.

   ⚠️ **Deleting is not optional tidying.** The plugin ships three PHP files that bootstrap WordPress from `$_SERVER['SCRIPT_FILENAME']` instead of `admin-ajax.php` and read `$_POST` with no nonce and no capability check: `framework/inc/cmsms-composer-templates-operator.php`, `inc/project/projects-loader.php`, `inc/post/posts-loader.php`. **A deactivated plugin's files still answer HTTP** — with the plugin off on od-dev all three returned 200 to an unauthenticated GET *and* POST, and **all three answer 200 on prod today**. Verify they 404 afterwards:
   ```bash
   for p in framework/inc/cmsms-composer-templates-operator.php inc/project/projects-loader.php inc/post/posts-loader.php; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://obshee-delo.ru/wp-content/plugins/cmsms-content-composer/$p"
   done
   ```
   Nothing is lost by deleting: the theme bundles the plugin as `themes/welfare/framework/admin/inc/plugins/cmsms-content-composer.zip`, a zip is not executed, and `cmsms-gutenberg-upgrade` never calls into the plugin — it is pure `preg_replace_callback` over the raw `post_content`, so it converts shortcodes whether or not they are registered.

**Verify after deactivating** — this is the od-dev list, and every one of them passed there: `/wp/v2/profile` 200 and `?slug=` still resolving percent-encoded Cyrillic; `/wp/v2/pl-categs` 200 (it 404s while cmsms owns it); `meta.cmsms_profile_subtitle` still in the payload; `wp-login.php`, the WP home page, one `/contacts/<region>/` and one `/profile/<slug>/` all 200 over HTTP — that last pair is what proves nothing in the `welfare` theme fataled without the plugin, `single-profile.php` included; and `wp cmsms migrate --dry-run` still runs, since the migrator must survive the plugin it converts away from.

**Two things not to do.** Don't register the CPT in a theme's `functions.php` — a theme swap would take 205 records out of the admin and out of REST. And don't skip step 2's verification: installing the mu-plugin *after* deactivating means a window in which 205 records have no post type, and the 75 regional query blocks ask for one that does not exist.

**One theme landmine to leave documented rather than fixed:** `themes/welfare/framework/function/theme-functions.php:1535` calls `new TwitterOAuth(...)`, a class that lived only in the deleted plugin, behind a guard that loads the wrong file. It is unreachable while the theme's Twitter widget is in no sidebar — check `wp option get sidebars_widgets` on prod before assuming the same, and if the widget is placed anywhere, remove it first.

⚠️ **Prod is WordPress 5.5.5 on PHP 7.x.** Everything `od-profile.php` calls predates 5.5 (`register_post_meta` is 4.9.8, `show_in_rest` on meta and taxonomies is 4.7), and the file is written to the same 7.0 floor as `od-revalidate.php` for the same reason — a parse error in an mu-plugin takes the whole site down. **Rollback is `rm`** plus reactivating the plugin.

⚠️ **One known gap, about legacy pages, live only once A6 ships.** Prod caches its own HTML with **WP Rocket** (§2 of `wp-backend.md`), which the A6 fallback fetches: purging Next before WP Rocket just re-caches the stale copy. When A6 lands, the order is WP Rocket first, then the frontend. (The other gap is closed: since 2026-08-18 the plugin queues `page` as `wp:pages` and `profile` as `wp:profiles`, not `post` alone, so an edit to a natively-rendered page or to a coordinator's record purges the pages built from it. A page still on the A6 iframe holds no WP fetch tag of its own — that one wants `paths`, which the endpoint already accepts.)

**Two dead links — ~~to remove~~ done 2026-08-15, on prod and od-dev both.** (A note, not a step — B8a took the number 2.6.) The `sidebar_bottom` links widget's `/sp/` (leyka form, no money taken since 2022-01-05) and menu item 27971 «Заказать материалы» (CF7 order form, mail lands in spam). Deleted at the source, so the frontend filters neither any more. What was removed, how to restore it, and what has to be decided before either comes back: [`next-steps.md`](./next-steps.md). Both pages still answer 200 on the A6 fallback — the links went, not the pages.

**2.7 Upgrade WordPress core (B10), then convert the content.** Prod is held at **5.5.5** by an active `wp-downgrade`, and everything downstream assumes modern core: the migrator writes `wp:query` / `wp:details` / `wp:group`, and `gutenberg.css` keys on the `is-layout-flex` layout classes core only emits from **5.9**. od-dev — which is what the frontend has been built and measured against — is on **6.8.8 / PHP 8.2** (read 2026-08-17).

Order matters: **core first, migrator second.** Converting content under 5.5.5 produces markup that install cannot render, and the failure is silent — a query block renders as an empty `<div>`, so a regional contacts page answers 200 with its news feed missing.

```bash
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes plugin deactivate wp-downgrade'
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes core update && wp --skip-plugins --skip-themes core update-db'
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes core version'
```

**Rehearsed on od-stage 2026-08-20, and five things came out of it.**

- **The pin is real and it lies.** With `wp-downgrade` active `core check-update` answers "WordPress is at the latest version" — it filters the update API, so a check is not evidence. Deactivate it first, then check. Keep it *installed* afterwards: it is the re-pin lever if the upgrade has to be undone.
- **5.5.5 → 7.1 in one hop**, `--locale=ru_RU`, and `core update-db` was a no-op (already at db 61833). No intermediate version needed.
- **PHP floor: WP 7.1 wants ≥ 7.4.** Read it from the API rather than guessing: `curl -s 'https://api.wordpress.org/core/version-check/1.7/?version=5.5.5&locale=ru_RU'` and look at `offers[].php_version`. **This is the one item that can block prod outright** — prod is `mod_php7` of unread minor, and if it is below 7.4 the upgrade cannot happen there at all until the host moves it.
- **The upgrade is what makes WP-CLI ordinary again.** Before it, timeweb's 8.2 CLI could not load the site at all, and `--skip-themes` was hiding the reason: it is not only the theme that fatals under PHP 8, it is **WP 5.5.5 itself** — `_wp_sidebars_changed` at `wp-includes/widgets.php:1265`, reached from `after_switch_theme`. Anything that switches a theme on 5.5.5 has to run under `/opt/php7.4/bin/php /usr/local/bin/wp`, not behind a flag. After the upgrade, plain `wp` works: no `--skip-plugins`, no `--skip-themes`.
- **`welfare` cannot survive PHP 8**, and the reason is not the one [`wp-backend.md` §2](./wp-backend.md#2-stack-on-od-dev) used to give. `functions.php:754` reads `remove_action( ‘woocommerce_after_shop_loop_item’, … )` — **typographic** quotes, pasted from a word processor — so the arguments are undefined constants. PHP 7 makes that a warning and carries on with the string; PHP 8 makes it a fatal `Error`. That is the whole difference between prod serving fine today and the same file dying the moment its host moves to 8.x. Under §0.4 this is a constraint on the **old** install, and it points the other way from what it used to: the new install goes to 8.2 with no `welfare` in it, and the old one must be **left on PHP 7 forever**, because it is what the A6 fallback renders. Whoever tidies the account's PHP versions after cutover has to know that.

**Verified after the upgrade, on od-stage** (site PHP moved to **8.2.32, apache2handler**, 2026-08-20): `/`, `/<id>/`, `/wp-admin/` and every REST route used by the app answer, and the migrated bodies carry `is-layout-flex` / `is-layout-constrained` / `is-layout-grid` in `content.rendered` — which is the B10 check, done by observation rather than by reasoning about core versions.

⚠ **Under §0.4 this runs on the clone, and two worries an earlier draft had here are void.** The old theme is not a risk, because it is deleted before core is upgraded rather than left to meet WP 7 — and the A6 frozen copy needs no capture, because it *is* the untouched old install. What remains is the `~/backups/` snapshot for the step itself (§7) and the PHP floor of the core version being installed, which is now a property of the new install's vhost rather than something prod imposes.

Then run the content conversion — [`wp-page-passthrough.md` §6](./wp-page-passthrough.md#6-running-the-migrator) — `wp cmsms backup` first, since it is what makes the rest reversible, and only then `wp cmsms migrate`.

**What that looked like on the prod clone.** `wp cmsms backup` copied **8565** originals into `nvp_content_copy` (`publish`, and only `post` / `page` / `profile`) — that is the per-post rollback, `wp cmsms restore`, and it is why the gzipped dump went from 26 MB to 34 MB. `--dry-run` predicted **5669 to change, 2896 unchanged**; the real run matched exactly, so the dry-run count is trustworthy as a gate. Afterwards: **5393 posts, 144 pages and 132 profiles** hold core Gutenberg where **none** did before — prod stores shortcodes in *everything*, not only in pages as B2 assumed. Budget the wall time: ~8500 records, a few minutes, and it is a single long-running WP-CLI call with no resume, so run it under `run_in_background` or `nohup` rather than an interactive session that a dropped SSH multiplex can kill.

**2.8 Apply the page fixes.** Workstream D's WordPress-side changes are scripts in this repo, not admin edits, precisely so this step is a handful of commands. Procedure and guarantees: [`wp-page-redesign.md`](./wp-page-redesign.md).

**Order matters.** The mu-plugin has to be in place before a page that binds to it renders, and the tag has to exist before `od-pages.php` can write a query over it — that script errors out rather than guess.

```bash
scp wp/mu-plugins/od-film-meta.php od-root:public_html/wp-content/mu-plugins/od-film-meta.php
ssh od-root 'php -l ~/public_html/wp-content/mu-plugins/od-film-meta.php'

scp wp/scripts/od-wp.php od-root:public_html/
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file od-wp.php'         # dry run
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file od-wp.php apply'

ssh od-root 'mkdir -p ~/public_html/wp-content/uploads/2026/08'
scp wp/assets/metodichki/*.jpg od-root:public_html/wp-content/uploads/2026/08/
ssh od-root 'ls -l ~/public_html/wp-content/uploads/2026/08/metodichka-zdorov*.jpg'

scp wp/scripts/od-pages.php od-root:public_html/
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file od-pages.php'         # dry run
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file od-pages.php apply'
```

**The three covers are a prerequisite, not a nicety — and the failure mode is
silence.** `/materials/metodichki/` is the one page whose fix points at uploads
*this project added* rather than at something the content already carried: the
library holds photographs of the printed booklets on white grounds, and Figma
`handbooks` draws the flat print covers, edge to edge. The files are committed at
`wp/assets/metodichki/` and `OD_METODICHKI_COVERS` in `od-pages.php` names them by
the **exact path** `wp-content/uploads/2026/08/`, so they have to be at that path
before the script runs. If they are not, `od_cover_full_size()` finds no source
basename to match, changes nothing, and reports nothing — the page just keeps the
booklet photographs, one of them at 220 px in a 387 px slot.

**A plain `scp` is the whole step, and `wp media import` is the wrong tool here.**
Import copies the file to *its* current month, which on cutover day is not
`2026/08` — od-dev's import month, which the map has to read the same on both
sides. The page's covers are raw `<img>` tags rather than `wp:image` blocks, so
nothing on the frontend needs an attachment to exist; od-dev has media-library
records for them only because that is how they were first uploaded. Register them
on production too if an editor should be able to find them in the library — after
the `scp`, and without a second copy of the file.

They will serve **from the WordPress origin, not the media bucket**, since nothing
in this install offloads on upload. `resolveMediaUrl` handles that by design — it
probes the CDN, takes the bucket's 301 as "absent" and falls back — but it is one
more reason to keep §5's image check on this page.

**`/about/` needs nothing uploaded, and that is worth knowing so nobody looks
for it.** Its partner strip names four files by path
(`OD_ABOUT_PARTNERS` in `od-pages.php`) — `2016/02/аси.jpg`, `фсин2.jpg`, `MO.png`,
`татарстан2.png` — and unlike the `metodichki` covers these are **production's own
uploads**, the first four of `/about/nashi_partnery/`. All four were checked on the
live site on 2026-08-19: each 301s to the media bucket and answers 200 there. The
three registration scans and the video are read out of the page itself, so they
carry production's own ids either way. The one prerequisite is the migrator: the
transform reads Gutenberg `<p>`s, so it must run **after** §2.7, and against
un-migrated shortcodes it refuses the page — «unexpected input: no «История»
paragraph», checked against production's stored body — rather than writing
anything. The hero is Kinescope, not the stored YouTube embed, and needs nothing
of production's: a Kinescope id is the same asset on either install.

**The nav-menu edits are `od-wp.php`'s**, not steps here (2026-08-20).
`od_wp_menu_edits()` deletes «Написать отзыв» — the footer's «Отзывы» column
already links that page, so the nav entry was a third route to one Contact Form 7
form — merges «Устав организации» + «Документы» into the one item «Устав и
документы», the pair being a tab strip on this side now, and drops «Наша
статистика», whose card came off `/about/` for the same reason. Items are found
by the path they point at, because the two installs disagree about the labels and
about the origins but not about the pages; «Наша статистика» is found by its
label, its url being a bare domain. So the `od-wp.php` run above does all of it
without a list of ids here. **One ordering note:** the merge leaves nothing linking
`/about/docs/` for anything that doesn't draw the tab strip, and the old theme
doesn't — so it wants the cutover window with the rest of workstream D, which is
where this step already sits.

**`/team/` and `/about/supervisory/` need `od-wp.php` to have run first.** Between
them they are fourteen links to fourteen `profile` records (`OD_TEAM` and
`OD_SUPERVISORY` in `od-pages.php`), and production is short of three:

- **Анна Панферова has no record at all**, under any status, on either server.
  `od_wp_create_profiles()` creates it — and on production it will *find* the
  photograph already in the library (attachment 74543 as of 2026-08-18) rather
  than importing a second copy, because it looks the path up before downloading.
- ~~**Александр Касатиков's record is a `draft` on production**~~ — **published
  2026-08-19.** The draft and od-dev's published copy differed in `post_status` and
  nothing else: same text, same photograph (71226), same `pl-categs` term
  (Тульская область), no revisions. `/profile/<his slug>/` answers 200 on the live
  site now.
- **Дамир Нигматянов and Михаил Федоренко** are the same case as Панферова, on
  `/about/supervisory/` — no record on either server, photographs already in both
  libraries since 2019, so `od_wp_create_profiles()` creates and attaches them
  without downloading anything.

Check both after the run:

```bash
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes post list --post_type=profile \
  --post_status=any --fields=ID,post_status,post_title --posts_per_page=400 --format=csv \
  | grep -iE "панферова|нигматянов|федоренко|касатиков"'
```

**`OD_TEAM` and `OD_SUPERVISORY` were read off production**, so unlike every other
entry in `od-pages.php` they are not derived from the pages they rewrite. Both
od-dev copies are stale, and not by a little: `/team/` there lists 13 people, six of
whom have left, and `/about/supervisory/` was last edited **2021-05-10** and lists a
member who has since left the council (production's was edited 2026-04-29). Figma
draws both stale rosters, having been traced from them. **If either live page has
changed since 2026-08-19, update the table before running this** — the transforms
will not read the new names out of the page.

`od-wp.php` addresses posts by slug, so it reports which of the programmes' films production is missing rather than tagging the wrong ones. It also fills each film's `poster_image_url` from an upload path — root-relative in the registry, with production's own origin put back by `home_url()` at write time — and never overwrites a value that is already there. Read that output before running `od-pages.php`.

`apply` is a positional argument, not a `--flag`: `wp eval-file` hands positionals to the script in `$args` and rejects unknown flags outright.

⚠️ **Run this only after §2.7's core upgrade, and address records by slug.** One
registry entry — the `/materials/metodichki/` coordinator — is addressed by
`title`, which is a WP_Query var added in **5.7**. On 5.5.5 it is ignored, the
lookup returns two records, and the runner refuses the entry with a warning
rather than writing to the wrong one. Every other entry uses `path`, which works
on any version.

It is idempotent by detection — a page already in its target shape is skipped — so a re-run after further work is safe.

**2.9 The frontend's service account — a role of two capabilities, not an administrator. Applied to od-stage 2026-08-23.** `od_frontend` exists there (`read`, `level_0`, `edit_theme_options`) and user 5367 was moved onto it from `administrator`; the application password was not reissued, because a role change does not invalidate it. Verified immediately after: `menus`, `menu-items`, `widgets`, `sidebars` and all four public routes still 200, while `posts/<draft-id>` went 200 → **403**, `posts?status=draft` → 400, `plugins` → 403 and `users?context=edit` → 403. A cache-busted `https://new.obshee-delo.ru/news/` then rendered fresh with all six footer widgets and the nav, so the frontend is unaffected. Rollback is `wp user set-role od-frontend administrator`. The frontend authenticates every WP request with one application password, so whatever that account can do, anyone holding the password can do. Measure what it actually needs before granting anything — on od-stage, anonymously versus authenticated:

| endpoint | anonymous | needs auth |
| --- | --- | --- |
| `/wp/v2/posts`, `/wp/v2/pages`, `/wp/v2/search`, `/wp/v2/profile` | 200 | no |
| `/wp/v2/menus`, `/wp/v2/menu-items`, `/wp/v2/widgets` | 401 | **yes** |

Those are the only seven routes `src/` calls, and the three that need a login all gate on the same capability, `edit_theme_options`. Nothing the frontend does needs any other. So the account gets a role with `read` + `edit_theme_options` and nothing else:

```bash
wp role create od_frontend "OD Frontend" --clone=subscriber
wp cap  add    od_frontend edit_theme_options
wp user create od-frontend it@obshee-delo.ru --role=od_frontend --user_pass="$(openssl rand -base64 32)"
wp user application-password create od-frontend next-frontend --porcelain   # prints the password once
```

An existing account moves with `wp user set-role od-frontend od_frontend`; the application password survives a role change, so it does not need reissuing for that alone.

**Why this is a security step and not tidiness.** `administrator` additionally grants plugin installation — remote code execution on the WordPress host from a leaked password — user management, and `read_post` on unpublished content. That last one had a consequence on the frontend: WordPress's *single-item* post route registers no `status` argument, so `check_read_permission()` falls through to `current_user_can('read_post')`, and an administrator credential makes `GET /wp/v2/posts/<draft-id>` return the draft in full. The catch-all served it at its bare `/<id>/` — confirmed 2026-08-22, `https://new.obshee-delo.ru/73790/` answered 200 with a draft's title and body to an anonymous visitor. `src/app/[...slug]/page.tsx` now filters on `status`, and this role is the second half of that fix: without `read_post` the route stops returning the draft at all. `edit_theme_options` is not nothing — it still permits editing menus, widgets and the customizer — but it cannot install code and cannot read private content.

**The password may contain spaces.** WordPress displays an application password chunked as `xxxx xxxx xxxx xxxx xxxx xxxx` — 29 characters — and `wp_authenticate_application_password()` strips every non-alphanumeric before comparing, so the 29-character form, the 24-character form with the spaces removed, and any other separator all authenticate identically (measured against od-dev 2026-08-23: 200, 200, 200). Store whichever you like in Coolify. In a **`.env` file, quote it** — `WP_PASSWORD="xxxx xxxx …"` — because an unquoted value with spaces breaks `. ./.env` in a POSIX shell, which is how several probes in this runbook read it. Docker's `env_file:` and `node --env-file` parse it unquoted either way.

Verify the account before moving on — the first three must be 200 and the fourth 401 or 404:

```bash
for e in menus 'menu-items?menus=<id>' widgets posts/<a-draft-id>; do
  curl -s -o /dev/null -w "$e %{http_code}\n" -u "$WP_USER:$WP_PASSWORD" "$WP_BASE/wp-json/wp/v2/$e"
done
```

One password per tier, never reused (§4.1). Revoke with `wp user application-password delete <user> --all`. It reaches the deploying build as a **BuildKit secret and never as a build-arg** — §4.7 explains what that cost once.

---

## 3. Film data — applying the filled worksheet

The source of truth is `.scratch/film-worksheet-filled.csv` (107 rows: 99 od-dev catalogue films + 8 that exist only on prod). It is gitignored — regenerate or copy it forward; §3.7 covers rebuilding it from scratch.

**Applied to od-stage 2026-08-20 — the numbers, and the one thing they reveal.** §3.1–3.4 ran end to end against the clone: **84 of 107 source rows matched a target row, 309 cells were written across 74 films**, and a second dry run reports `0 field(s)` — the idempotence guarantee holding. Coverage on the clone's **85** published catalogue films: `kinescope_id` **74**, any `share_*` 32, a download slot 35, `poster_image_url` 11, `watch_url` 0. Since the whole sheet came from od-dev, **that is also the measure of how far od-dev's film data travels to prod: most of it does**, which is the point of remapping by title rather than by id.

The 23 rows that did **not** land are the interesting part, and none of them is a lost value — see §3.3. Two mechanics to know before reading that list: `pnpm film:export` scopes to the **four catalogue categories** and to **`publish`**, so a film that is a draft or sits outside them has no row to remap onto; and exporting with `--all` (every `format=video` post — **187** on the clone) changes nothing here, because all 74 writes landed inside the catalogue anyway.

**3.1 Export the target environment's own sheet.** Point `.env` at the target first (`WP_BASE`, `WP_USER`, `WP_PASSWORD`):
```bash
pnpm film:export -- --out .scratch/film-worksheet-stage.csv
```

**3.2 Remap our filled values onto the target's post ids (B4).**
```bash
pnpm film:remap -- --from .scratch/film-worksheet-filled.csv \
                   --onto .scratch/film-worksheet-stage.csv \
                   --out  .scratch/film-worksheet-stage-filled.csv
```
Joins by normalised title, rewrites ids, fills only cells the target leaves empty, and **lists everything it refused to guess**. Read that output — it is the manual work-list for 3.3.

**3.3 Resolve by hand what remap wouldn't guess.**
- **The 8 prod-only films** (they have no od-dev post): «Правда и ложь про сухой закон 1985 года», «День рождения», «Как найти призвание», «Алкоголь. Взгляд изнутри», «Большая опасность маленьких размеров», «Папуасы», «Три секрета, как раскрыть призвание», «Сахар атакует». **Four of the eight matched by title on the clone** («Сахар атакует» 74794, «Алкоголь. Взгляд изнутри» 73084, «Большая опасность…» 73381, «Как найти призвание» 72705); the other four are in the list below.
- **Two duplicate-title pairs** — `38424`/`32168` «Влияние кино на общество … Николай Бурляев» and `38420`/`31445` «История трезвеннических движений в России!» (each an «Известные люди» post duplicated as «Видео события»). Remap skips them by design. Neither carries Telegram data today, so they're safe to leave empty — or dedupe them editorially. On the clone `38420` is a **draft** and `31445` is published, so the pair is less symmetric than it looks.

  **What the clone actually reported (2026-08-20), and why it is editorial rather than a fix.** Of the 23 rows that found no target, **13 are the same film, published on od-dev and left a `draft` on prod** — all `format=video` in «Известные люди» (559), title-identical, so the sheet's data is ready the moment someone publishes them: **38428** Липовой, **37635** Федоров (алкоголь), **37632** Мышкин, **37509** Федоров (ювенальная юстиция), **37506** Жданов, **34001** Хасьминский, **29715** Минин, **29711** Вакулинская, **29705** Деревянко, **29224** Бхакти Расамрита Свами, **20810** Сати Казанова, **20803** Задорнов, **20788** «Зачем России гомосексуализм?». The clone carries **19** such drafts inside the catalogue categories («Известные люди» 36 published / 19 draft, «Фильмы» 26 / 1), which is the whole gap between od-dev's 99 catalogue films and the clone's 85. **Publishing them is an editorial call, not a migration step** — the same shape as the two `profile` drafts §0.6 item 9 found.
  - **Two of those drafts have a published twin, so publishing them would duplicate a page**: `37509` vs **15068** «… Депутат Евгений Федоров» (`video`, already in the catalogue — it took the sheet's data), and `29711` vs **21035**, which is `standard`/«Новости». Merge before publishing.
  - **Some films are plain news posts on prod**, not catalogue films: **18776** «Секреты успеха. Дмитрий Чугунов», **18978** «Павел Деревянко о наркотиках», **20954** «Как бросить курить? Денис Минин», **12808** «Зачем России гомосексуализм?» — all `standard` in «Новости» (47), which is why the catch-all renders them as articles and not as films. Changing `post_format` is editorial too.
  - **19894 «День рожденья» is published `video` but carries only category 85**, the parent «Видео» — so it is invisible to the catalogue, which queries the four children. The sheet spells it «День рождения», hence no title match either. One category fixes both.
  - **No post on the clone at all**: «Ведущий педиатр России …», «Социальный ролик Папуасы», «Три секрета, как раскрыть призвание». «Правда и ложь про сухой закон 1985 года» has only a near-namesake, **60862** «… про сухой закон Горбачева», `standard` in «Статьи» — same subject, different post, so do not assume they are the same film.

**3.4 Dry run, read it, then apply.**
```bash
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv                    # dry run
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv --only <one-id> --apply
pnpm film:import -- --in .scratch/film-worksheet-stage-filled.csv --apply
```
Guarantees: only changed fields are sent, an **empty cell never clears** an existing value (a literal `-` clears), rows without an id are listed and skipped, and reads/writes retry 3× so one flaky response can't abort the batch. Re-run the dry run afterwards — a clean `0 field(s)` is the confirmation.

**3.5 Upload the cover art.**
```bash
pnpm film:covers -- --export "/path/to/ChatExport_2026-08-03"            # dry run
pnpm film:covers -- --export "/path/to/ChatExport_2026-08-03" --apply
```
Uploads the Telegram key art as `film-cover-<postId>.jpg` and sets it as the featured image. Only touches films with **no** featured image and reuses an existing upload of the same filename, so re-running is a no-op. On od-dev this took featured-image coverage from 6 → 29 of 99.

**Then `pnpm film:posters`**, which fills `poster_image_url` — the film page's poster card — from the best source the install already holds: the Яндекс.Диск плакат behind «Скачать плакат» (downloaded and uploaded), else a плакат-named image in the post body, else the featured image. Run it **after** 3.5, since the covers it falls back to are what 3.5 uploads. Dry-run by default; a плакат is never overwritten, a cover written as the fallback is recomputed each run, so a плакат arriving later still wins. ⚠ **It needs an account that can edit.** od-stage's `od-frontend` password is the two-capability role of §2.9 (`read` + `edit_theme_options`), so every write answers `403 rest_cannot_edit` and the run reports «0 set, N failure(s)» — read the summary, not the exit code, if you pipe it through `grep`. Any write pass on that tier (this, `film:import`, `film:covers`) needs an editor or administrator application password.

**3.6 Fill `kinescope_id` from the Kinescope library.** Needs `KINESCOPE_TOKEN` in `.env` (API token from the Kinescope dashboard — the org's library already holds **261 videos**, so most films can be matched automatically rather than hand-entered).
```bash
pnpm film:kinescope -- --in .scratch/film-worksheet-stage-filled.csv     # fills in place, prints the report
```
**The YouTube bridge is what makes this work.** The library was imported 1-to-1 from YouTube, so a Kinescope title *is* the source YouTube title, while the WP title is the plain editorial one («Докажи, что любишь» vs «ЭПИДЕМИЯ о которой ты не знал…»). When a film has `share_youtube`, the script resolves that video's title through YouTube oEmbed (public, no API key) and matches on it; WP-title similarity is only the fallback. Measured on od-dev: the bridge agreed with 16 of 17 already-matched films and resolved 11 of 11 that title matching had missed **or matched wrongly** — so populating `share_youtube` (§3 from Telegram) is a prerequisite worth doing first, not an optional extra. If YouTube is unreachable from where you run this, the bridge silently degrades to title matching, which is materially worse — check the report's «via the YouTube bridge» count is non-zero.

The stored value is the **short id from `play_link`** (`https://kinescope.io/<short>`), because that is what `FilmPlayer` embeds. The API's `id` field is a different UUID and must **not** be used. Matching is deliberately conservative and refuses to guess: trailers/teasers and numbered course lessons are excluded, and where a download label carries a duration it is checked against the Kinescope duration — a mismatch is reported rather than written. Re-run `film:import` afterwards to push the new ids. On od-dev this took `kinescope_id` from **1 → 70 of 99**.

**3.7 If the filled sheet is lost.** Re-derive it: export the target sheet, then re-run the Telegram harvest against `ChatExport_2026-08-03/result.json` (channel **«ФИЛЬМЫ | ОБЩЕЕ ДЕЛО»**, 38 film posts → title, Dzen trailer, VK/Rutube/YouTube, 2–5 Яндекс.Диск downloads with durations). Match by title **and** cross-check the Яндекс.Диск file ids shared with the post body — that's what disambiguates same-series films. Posters come from the **WP body** («Скачать плакат» anchor → `poster_download_url`, плакат-named `<img>` → `poster_image_url`), never from Telegram's 16:9 art.

**3.8 Outstanding editorial work — not blocking deploy.** Tracked as **B-VIDEO2** in [`implementation-plan.md`](./implementation-plan.md); the summary below is the same list.
- **`kinescope_id`: 70 of 99 after §3.6.** The 29 without one fall back to poster → `watch_url` → bare poster. Nearly all are «Известные люди» short interviews with no distinctive title and no `share_youtube`; each YouTube link added converts directly into a resolved id, so that is the lever. Two structural aids the report prints:
  - **Description hints.** The library is a 1-to-1 YouTube import, so descriptions are the YouTube descriptions, and a retitled upload usually names the real film in its opening line — this is how 67400 «Курение. Взгляд изнутри» was found under the title «Вред вейпа, айкоса, кальяна, курения – ДОКУМЕНТАЛЬНЫЙ ФИЛЬМ». Suggestions only, never written: the same film names recur in every video's cross-promo footer.
  - **Orphan list.** Film-length (≥8 мин) Kinescope videos claimed by no row, so the tail can be paired by elimination instead of searching 261 titles. That is what resolved the previously-ambiguous 19871 — its rival id was already claimed by 63287.
  - **Duplicate uploads are normal in this library** — several films exist twice, e.g. «Утерянная добродетель» as both a 32-мин and a 59-мин cut, and «Деньги с дымком» under both a plain and a marketing title. An orphan that looks like an already-matched film is usually a second upload, not a missed match.
  - **28749 «The Mystery of the Deadly Smoke»** is the English cut; three Russian «Тайна едкого дыма» versions exist, no English one. (An English «Istoriy s ushami» does exist, so English uploads are sporadic rather than absent.)
  - **37626 / 14590 / 32168** duplicate other WP posts (26122 / 38406 / 38424) — merging the posts is the better fix than assigning the same video twice.
- **`watch_url`: 0 of 99.**
- ~~The 8 films missing from od-dev should be confirmed present on prod.~~ **Checked on the clone 2026-08-20:** four are there and took their data (74794, 73084, 73381, 72705); «День рождения» is **19894** «День рожденья» with no catalogue category, and three have no post at all — §3.3.
- **67400 «Курение. Взгляд изнутри» has a mislabelled download** — `disk.yandex.ru/i/-5L5AfVOrXQFlw` is stored as «Сокр. версия» but is the 35-минутная полная версия.
- **39664 «Как научиться любить?» has no `share_youtube`** — the channel gives it the same link as 71933, which belongs to 71933.

---

## 4. Frontend configuration and deploy

**4.1 Environment variables** (per deployment tier — read at module load, so a restart is required after any change; `REVALIDATE_SECRET` is the one exception):

| var | value | note |
|---|---|---|
| `WP_BASE` | target origin, **no** `/wp-json`, no trailing slash | also drives `images.remotePatterns` |
| `WP_USER` / `WP_PASSWORD` | application password for that env | never reuse across envs |
| `WP_MEDIA_CDN` | prod bucket, or `""` to disable the rewrite | defaults to the od-dev Yandex bucket — **override for prod** (B6) |
| `SITE_URL` | the public origin of *this* deployment, no trailing slash | **new with F4.** Feeds `metadataBase`, every `rel=canonical`, `sitemap.xml` and `robots.txt`. Defaults to `https://obshee-delo.ru`, so an unset var on stage makes stage advertise **prod's** URLs — it fails silently and only shows up in a crawler. Set it explicitly on every non-prod tier. |
| `REVALIDATE_SECRET` | a random per-tier secret | **new with B4.** Gates `POST /api/revalidate/`. Unset ⇒ the endpoint 503s and purges nothing, which is the safe default; a tier holding *another* tier's secret is a hole, so generate a fresh one each time. Read per request, so no restart needed. |
| `WP_LEGACY_BASE` | origin of the old site the fallback proxies, no trailing slash | **new with A6.** Live prod (`https://obshee-delo.ru`) until the frozen copy exists; only the origin is kept, any path or query is discarded. Unset ⇒ the fallback is off and ~170 pages 404 exactly as before A6 — safe, and the rollback. **The container needs outbound HTTPS to this origin**; without egress every legacy page 404s and the log fills with `[legacy] upstream error`. **After cutover it must not be this deployment's own origin** — the app then proxies itself, embedding its own shell one frame deeper each time. It warns at boot (`[legacy] WP_LEGACY_BASE is the site's own origin …`) but does not stop, because the two match harmlessly on a developer's machine. **The frozen copy must be cloned with the usual domain search-replace** so its HTML emits its own host: in-content links are rewritten by comparing them against the origin the page was fetched from, so a copy still emitting `obshee-delo.ru` links leaves them un-rewritten — 32 of `/team/`'s 80 anchors are absolute to the current host. Harmless on prod (that host is ours by then), but on stage it sends visitors to live production. |
| `KINESCOPE_TOKEN` | Kinescope API token | **scripts only, never needed at runtime or in the image** — used by `film:kinescope` (§3.6) |

**4.2 Regenerate the API types** once the target serves REST — `redocly.yml` still points at `od-dev.tmweb.ru/wp-json-openapi`:
```bash
pnpm generate:types && npx prettier --write src/types/generated/wp-json-openapi.ts && pnpm type-check
```
> The output path was fixed on 2026-08-13 (it had a stray space and wrote to a directory named `generated `). Prettier is not optional here: the CLI emits double quotes and 4-space indent, so without it the diff is 35 000 lines of formatting instead of the handful that changed.

**4.3 Apply the real category ids (B5)** if §1.3 differed from od-dev. **One file since 2026-08-13** — `src/shared/config/filmCategories.ts`, which holds `FILM_CATEGORIES` (URL segment → id: `filmy` 581, `multy` 580, `roliki` 86, `famous-people` 559) and is read by `/video/` and `/video/<segment>/`, the related-films scope on a film page, the catch-all's SSG seed, `sitemap.xml` and the A8 redirect table. Change the four numbers there and every consumer follows. **Do not rename the keys** — they are the live site's URL segments, and `/video/multy/` and `/video/filmy/` are the #2 and #3 entry pages on the site.

Two things that are *not* in that file and still need a look:
- **`src/shared/config/newsCategories.ts`** — the news equivalent, `NEWS_CATEGORIES` (`nashi-dela` 47 / `articles` 578), equally environment-specific. Read by the `/news/` chips **and** by `/materials/articles/`, so 578 being wrong empties that page as well as the chip. `legacyRedirects.ts` points `/category/novosti/` at the chip **key** and `/category/articles/` at `ARTICLES_HREF`, never at an id, so it follows this file automatically.
- **`scripts/lib/wp.mjs`** — its own `FILM_CATEGORY_IDS` copy, because the scripts are zero-dep Node and can't import TypeScript. ⚠️ **This one is used in §3, before you get here** — a wrong id makes `film:export` write an empty worksheet, which looks like "no films need data" rather than an error. Fix it during §1.3, not §4.3.

A wrong id here **fails quietly rather than loudly**: the catalogue answers 200 with an empty or unfiltered result rather than 404ing, so §5 gates 1–2 (card counts matching WP) are what actually catch it.

**4.4 Image hosts.** `WP_BASE` and `WP_MEDIA_CDN` are allowlisted automatically. The Punycode legacy domain `xn----9sbkcac6brh7h.xn--p1ai` is hardcoded and still in use (70199's poster image) — keep it until those assets are re-hosted.

**4.5 Build.** `output: 'standalone'`. `staticGenerationRetryCount: 3` + `staticGenerationMaxConcurrency: 4` exist because od-dev 503s under the default parallel prerender; keep them unless prod is provably faster.

**The container image was built and run for the first time on 2026-08-21, against the clone, and it did not work.** Three defects, all of them invisible to `pnpm build` and to CI, and all now fixed — read this before trusting a deploy:

- **`Cannot find module '/app/server.js'`** — the container exited on start and never served a request. `pnpm-workspace.yaml` at the repo root makes Next trace files from the workspace root, so the standalone build nested itself one directory deep (`/app/app/server.js`) while `CMD node server.js` looks in `/app`. Fixed by `outputFileTracingRoot: import.meta.dirname` in `next.config.ts`, which flattens the output — the layout every `COPY --from=builder /app/.next/standalone ./` in the world assumes.
- **An empty header and footer on every prerendered page.** Without `WP_USER`/`WP_PASSWORD` at build time `httpClient` falls back to its stub, the build still succeeds, and the root layout's nav-menu and widget-area fetches return nothing — which is then **baked into the static HTML** and served for the whole hour of `revalidate = 3600`. Measured: `/` answered 200 with `x-nextjs-cache: HIT` and not one `<aside>` in the footer, while `/news/`, rendered on demand, had all six. So the credentials are needed at build too — but as a `RUN --mount=type=secret`, never as build args. An arg is written into the build record buildx publishes as a workflow artifact, which on this public repo leaked the od-stage application password for two days in August 2026 (§4.7). A secret mount lives only for that `RUN`: no record, no attestation, no layer.
- **`getaddrinfo EAI_AGAIN` part way through the prerender**, reproducibly, on a machine whose DNS is fine — a single `getent` inside the same sandbox resolves, and `--network host` does not help. musl does not retry and does not cache, and the prerender makes hundreds of requests to WordPress from four parallel workers. **The base image is now `node:22.16.0-slim` rather than `-alpine`**, and `libc6-compat` went with it. Bigger image, a build that finishes.

After those three: 52/52 static pages generated, `/health/` 200, and **`pnpm url:check --base http://localhost:3000 --top 200` reports 99.7 % entry-traffic coverage** (197/200 URLs, 20 847/20 907 visits) with the A6 fallback pointed at live prod. The three misses are `/sms/`, which 404s on production too, and the two `profile` records that are `draft` there.
```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build
```

**4.6 Deploy target — Beget VPS running Coolify (A2, decided).** Rationale and sizing live in [`servers-agent/docs/vps-coolify-plan.md`](../../servers-agent/docs/vps-coolify-plan.md) §od-frontend.

**The VPS exists as of 2026-08-21: `ssh od-vps`, panel https://coolify.obshee-delo.ru.** The stage tier runs there — application `od-frontend-stage`, domain **https://new.obshee-delo.ru**, pointed at the od-stage clone, deployed from CI and measured at **99.7 %** entry-traffic coverage (gate 12) on that domain. Server facts, backups and DR live in the ops repo ([`servers-agent/docs/vps-coolify.md`](../../servers-agent/docs/vps-coolify.md)); what this repo puts on it is [`implementation-notes.md` §A3b](./implementation-notes.md).

- **The VPS never builds.** Next 16 + React Compiler needs ~1.5–3 GB and would OOM next to Coolify/Outline. Images are built in **GitHub Actions → GHCR**; Coolify only pulls.
- **Pass `WP_BASE` and `WP_MEDIA_CDN` as build-args** — `images.remotePatterns` is evaluated at build time, so a wrong value here makes `next/image` return 400 for every production image. `WP_USER`/`WP_PASSWORD` **are** needed by the deploying build (see the empty-shell note above) but go in as BuildKit secrets, not args; CI's *verification* build passes neither and runs against the stub client, which is why nothing is baked in there.
- **Runtime env in Coolify:** the §4.1 table, plus `WP_LEGACY_BASE` once A6 lands.
- **Container:** port 3000, `HOSTNAME=0.0.0.0`, non-root `nextjs` user. **512 MB – 1 GB**, hard `mem_limit`, `--max-old-space-size` 256–384 (idle is 80–150 MB but `sharp` peaks 300–500 MB; 256 MB risks OOM, and V8 will otherwise grow to fill the host).
- **Persistent volume on `/app/.next/cache`** — without it every redeploy cold-starts into a request burst against the slow WP plus full image re-encoding.
- **Health check → `/health/`** (added 2026-08-04). ⚠️ **With the trailing slash** — A8 turned on `trailingSlash: true`, so a probe of `/health` gets a 308 to `/health/`; whether that counts as healthy depends on the probe's redirect handling, so configure the slashed form and don't rely on it. It never touches WP on purpose: a WP hiccup must not make Coolify restart a healthy container. Do not point the probe at `/`.
- **Pin the Next minor** — 16.1.0 has a known Docker memory-leak thread (vercel/next.js#88603).
- **WordPress stays where it is** — prod's WP on BeGet (`ssh od-root`), dev/stage on Timeweb. The container reaches whichever `WP_BASE` names over public HTTPS.

**4.7 CI build + deploy — DONE 2026-08-21.** `.github/workflows/ci.yml` now has a second job, `image`, gated on the first (`needs: ci`) and on `main`: it builds the Dockerfile, pushes `ghcr.io/obshee-delo-it/od-frontend:{stage,<sha>}`, pins the Coolify application to the sha and deploys it, polling the deployment to completion. Detail, including the Coolify application's own settings, in [`implementation-notes.md` §A3b](./implementation-notes.md). ⚠ **It passes three build-args and two BuildKit secrets** (§4.5). Args: `WP_BASE`, `WP_MEDIA_CDN`, `SITE_URL`, all evaluated at build time and none of them secret. Secrets: `WP_USER` and `WP_PASSWORD`, without which the pushed image ships an empty header and footer on every prerendered page — delivered through `secrets:` → `RUN --mount=type=secret`, **never** `build-args:`. They were build-args from 2026-08-21 to 2026-08-23, and buildx put every one of them in the `.dockerbuild` record that `docker/build-push-action@v6` uploads as a workflow artifact by default; on a public repo that is a published password, readable by any GitHub account, once per push to `main`. `provenance: false` was already set and covers a different channel. The od-stage credential was rotated on discovery; the job now also sets `DOCKER_BUILD_RECORD_UPLOAD: false`. CI's *verification* build stays secretless on purpose — that is a virtue, and it is why this was never caught there — but the image that deploys cannot be. **For prod, the second tier is a second Coolify application and a second set of variables**, not a change to this job: `SITE_URL` is baked at build time, so one image cannot serve both tiers.

`.dockerignore` was fixed on 2026-08-04 (it had been named `.docerkignore`, so Docker ignored it entirely while the Dockerfile does `COPY . .` — a local build would have baked `.env` into a layer). Building in CI avoids that class of leak anyway, which is a further argument for never building on a developer machine.

**4.8 ISR caveat.** The ISR cache lives on the container filesystem, so it is **per-replica**. Scaling past one instance needs a shared `cacheHandler` — and note the same applies to purges: `POST /api/revalidate/` clears the replica that receives it, so on more than one instance every replica has to be hit, or the shared handler must land first.

`revalidate = 3600` everywhere. **On-demand revalidation is built on both sides and waits on one line of config** (B4): the app exposes `POST /api/revalidate/`, every WP fetch is tagged, and the mu-plugin is installed on od-dev — but with `OD_REVALIDATE_URL` commented out, because there was no deployment to purge. Per tier: set `REVALIDATE_SECRET` on the frontend, then point WP's `OD_REVALIDATE_URL` at `https://<that tier>/api/revalidate/` (trailing slash — the bare form is a 308 and WP does not re-POST). Verify the two secrets match by digest, never by printing them; the whole procedure is [`wp-backend.md` §6.5](./wp-backend.md). Skip it and WP edits take up to an hour to appear — tell the editors, or close the loop first. **Give each tier its own secret**; prod's on stage is access to prod's cache.

⚠️ **One WP install can only notify one frontend.** `OD_REVALIDATE_URL` is a single constant, so pointing od-dev at a stage deployment means a local dev server never gets purged — and pointing prod's WP at stage would silently leave prod stale. It is per-install config, not per-tier-pair.

---

## 5. Verification gates

Run against the deployed target, not localhost.

Post detail lives at the bare **`/<id>`** since A8 — that is the *only* address it has, so gates 3–5 must use it. `/video/<id>` and `/news/<id>` were this project's own pre-launch shape and now **404 by design**; if either answers 200, someone has re-added a route that gives one film two URLs.

1. `/video/` — 200, ten cards, pagination present. Card count should equal §1.6's four-category total (od-dev: 99), **not** the full `format=video` count.
2. Each category is its own page — `/video/filmy/`, `/video/multy/`, `/video/roliki/`, `/video/famous-people/` — 200 with no redirect hop, and each count matches WP (od-dev: 23 / 8 / 15 / 55). An unknown segment such as `/video/nonsense/` must **404**, not serve «Все».
3. `/<id>` for a film with downloads — pills render with durations; share tiles show the VK/Rutube/YouTube brand marks; breadcrumbs «Видео → title».
4. `/<id>` for a film with `kinescope_id` — the Kinescope iframe plays. 70 of 99 qualify on od-dev after §3.6.
5. `/<id>` for a film with a poster — the sidebar плакат card renders with «Скачать плакат».
6. Card thumbnails resolve (covers from §3.5) — no broken images, no `wp.invalid`.
7. `/` and `/news/` still render, and `/<id>` for a **news** post renders the article (not the film layout) — the news path shares `resolveMediaUrl` and `parsePost` with video.
    - `/materials/articles/` — 200, and the card count equals the «Статьи» category count from §1.3 (od-dev: **19**). A count of 0 or of *every* post means `NEWS_CATEGORIES.articles` has the wrong id for this environment (§4.3) — both answer 200, so only the count catches it.
    - Its `<link rel="canonical">` is `<SITE_URL>/materials/articles/`, and `/news/?category=articles` carries **the same** canonical while `/news/?category=articles&page=2` carries its own. That pair is the whole point of the alias; if the first two diverge the collection has two addresses again.
8. A film with **no** ACF data degrades gracefully: no empty pill strip, no phantom poster card.
9. `pnpm film:import --in <sheet>` reports `0 field(s)` — data landed and persisted.
10. 375px and 1440px on `/video/` and one film page.
11. `/health/` returns a plain `ok` (Coolify's probe target — **note the trailing slash**, see §4.6).
12. **No 404 on the live site's real URLs (A8) — the gate that proves the biggest change. Automated: `pnpm url:check`.**
    ```bash
    pnpm url:check                                       # against localhost:3000
    pnpm url:check -- --base https://od.webtm.ru        # against a deploy
    pnpm url:check -- --top 500 --fail-under 95
    ```
    It replays the real entry URLs from the Yandex Metrica **«Страницы входа»** export (Отчёты → Стандартные отчёты → Содержание → Страницы входа → export; `--csv` to point at a specific file, otherwise the newest export under `~/Documents/od/ya.metrika/`), **ranked by the entry visits each URL actually earns**, and reports results weighted by traffic rather than by URL count. Flags: `--base`, `--csv`, `--top` (default 200), `--concurrency` (default 8), `--fail-under` (exit 1 below that coverage %). The headline number is **«Entry-traffic coverage»**, and failures are automatically grouped by section — no flag needed.

    **Reading the output — two classes of 404 are expected and fine:** pages not yet redesigned (every `/about/*`, `/materials/*`, … until A6 lands), and posts missing from the environment under test (od-dev is a stale copy, so recent ids 404 locally and resolve on prod). **What must never appear is a *shape* failure** — `/<id>/` or `/video/<segment>/` failing across the board, which is the difference between "this section isn't built" and "A8 is broken". Sanity-check that the run covered: one `/video/<segment>/` served directly, one `/category/video/mult/` (256 entries on its own), one `/page/N/`, and one `/category/<anything-else>/`. **Nothing under `/category/` may 404** — the proxy redirects that family exhaustively, including the ~88 `/category/oblast/<region>/` archives and the Cyrillic slugs, so a 404 there means the catch-all rule was lost.

    **Run this after every deploy, not just before launch.** Since A6 it is the fallback's only production
    signal: there is no alerting stack here, so a silent regression on ~170 pages would otherwise be noticed
    first by a visitor. The number to watch is **98.8 %** (measured 2026-08-14 with the fallback on); a drop
    back toward 83.7 % means the fallback is not serving. The container logs are the second signal, and are
    greppable by design — every line starts `[legacy] `:

    | line | means |
    |---|---|
    | `WP_LEGACY_BASE missing — legacy fallback disabled` | once at boot; explains a fleet-wide 404 |
    | `WP_LEGACY_BASE is the site's own origin (…)` | once at boot; after cutover the fallback would proxy itself |
    | `upstream <status> for <path>` | the legacy origin answered 404/410/5xx |
    | `upstream error for <path>: <message>` | network failure, DNS, or the 8 s timeout — check egress first |
    | `upstream busy for <path>` | the concurrency cap's wait budget ran out; the origin is slow, not down |
    | `upstream non-HTML for <path>` / `upstream oversized for <path>` | the origin served something that is not a page |
    | `upstream redirect refused for <path>` | the origin redirected off its own origin |
    | `boundary miss for <path>` | that legacy page has no `section#middle`; informational, it still renders |
    | `unbalanced <element> for <path>` | markup the transform could not match; the old chrome is showing |
    | `rejected path <path>` | a slug failed validation — usually someone probing for traversal |

    **Every redirected shape must be a single 301 hop, and every served shape zero.** The rules live in `src/proxy.ts` (Next 16's renamed middleware), *not* in `next.config.ts` `redirects()` — a config table can't emit a slash-terminated destination under `trailingSlash: true`, so each URL would take two hops. If you ever see a chain of two here, someone has moved a rule back into the config, where it also silently shadows the proxy. **A redirect answering 200 is not proof it worked:** twice during A8 a rule pointed at a filter value the destination didn't recognise, which renders an *unfiltered* list at status 200. Check the content, not the status.

    **Also verify what the site advertises** (F4, shipped with A8): `/sitemap.xml` is a well-formed XML with ~8 000 `<loc>` entries, every one slash-terminated and none of them a URL that redirects; `/robots.txt` names that sitemap at the **production** host — which comes from `SITE_URL` (§4.1), so a missing env var here publishes 8 000 canonical URLs pointing at the wrong domain.

    **Baseline to beat — localhost against od-dev, 2026-08-13: `84.2 %` coverage** (125/200 URLs, 17 606/20 907 visits), zero shape failures. It was 83.7 % before the `/materials/articles/` alias route added its 114 visits. The 15.8 % that failed is 3 076 visits of not-yet-redesigned sections (Materials still biggest at 1 166) plus 225 visits of five post ids absent from od-dev (`73381`, `73084`, `72705`, `74794`, `74557` — all `rest_post_invalid_id`). **Against prod those five should resolve, so a prod run before A6 should land near 85 %, and near 100 % after it.** A number materially below that means something is wrong with the URL layer, not with the content.

13. **The shell is in the *prerendered* HTML, not only in a live render.** This is the gate the rehearsal had to invent, because every other gate passed while it failed:
    ```bash
    curl -s https://<target>/ | grep -c '<aside id="block-'      # expect 6
    curl -s https://<target>/ | grep -o 'ГЛАВНАЯ\|ФИЛЬМЫ\|КОНТАКТЫ' | sort -u | wc -l   # expect 3
    curl -sI https://<target>/ | grep -i x-nextjs-cache          # HIT means you are reading the build's copy
    ```
    Check `/` (prerendered) **and** a route that renders on demand. If the second has a header and footer and the first does not, the image was built without WP credentials — §4.5. An empty shell on the busiest URL of the site, for an hour, at status 200.
14. **No shortcode soup left.** `[cmsms_` on published pages and posts must be **0**:
    ```bash
    ssh <wp> "$W db query \"SELECT COUNT(*) FROM wp_posts WHERE post_content LIKE '%[cmsms\_%' AND post_status='publish' AND post_type IN ('page','post')\" --skip-column-names"
    ```
    Drafts, revisions, trash and the dead CPTs still carry it and that is fine — nothing renders them.
15. **Both content scripts are fixed points.** `od-pages.php` with no `apply` reports `already in shape` for every record, `0 writes` and — the part that is easy to miss — **`0 warnings`**; `od-wp.php` reports `skipped` on every line. A warning means one page was silently left as the editor's original, at 200 (§0.7).
16. **`pnpm pages:inventory` against the target**, and read the `no page — 404` bucket rather than the headline. Every entry there is a URL real traffic lands on; on the clone they are `/sms/` (a page production never had) and eighteen regional URLs the live site links from its own map and 404s on today ([`page-inventory.md` §1a](./page-inventory.md)).
17. **`pnpm map:generate --dry-run`** exits 0, and the linked/unlinked split is the one you expect — 52/30 on the clone. A throw here means a region page moved or was trashed; a *bigger* grey count than expected means several did.

---

## 5.5 Cutover — what actually moves

Under §0.4 this is the whole of "going live", and it happens only after every §5 gate is green against the new install. Both installs are on **BeGet** (§0.4), so nothing below is a host migration — it is a vhost change, a few config edits and one DNS record.

**First, a naming point that decides work later.** Three hostnames exist after cutover, not two, and the apex is not WordPress:

| host | serves | where | env var |
| --- | --- | --- | --- |
| `obshee-delo.ru` | the **Next frontend** | the Beget VPS + Coolify (§4.6) | `SITE_URL` |
| a stable subdomain — pick `wp.obshee-delo.ru`, not `new.…` | the **new WordPress install** | BeGet shared, new site | `WP_BASE` |
| `frozen.obshee-delo.ru` | the **old install**, untouched | BeGet shared, `~/public_html` today | `WP_LEGACY_BASE` |

**Give the new install its permanent hostname on day one.** `new.…` looks harmless and isn't: `WP_BASE` is baked into `images.remotePatterns` at **build** time, it is what a database-wide search-replace writes into 8 500 bodies, and it is the origin `resolveMediaUrl` probes. Renaming it after the fact means another search-replace, another rebuild and a re-verification of every image. This is exactly the cost od-stage paid going from `stage.od.webtm.ru` to `od.webtm.ru` (§0.5), for a much smaller install. If the new install is given `wp.obshee-delo.ru` from the moment it is cloned, steps 1–4 below are the *only* time its host is ever written.

**On the new install** — the same four edits §0.5 records doing twice, so they are known:

1. `WP_HOME` / `WP_SITEURL` in `wp-config.php` → its permanent hostname.
2. The `.htaccess` canonical-host 301 → the same. Left pointing anywhere else it sends every request away, and this is the one that bites hardest because it fires before WordPress loads.
3. `wp search-replace <temp-host> <permanent-host> --all-tables --precise --skip-columns=guid`.
4. **Read the `siteurl` / `home` option rows directly.** The `wp-config.php` defines mask whatever is in them, so a stale value is invisible until something reads the option — on od-stage those rows still held `https://cs16182.tmweb.ru` from a host move years earlier, inherited straight from prod's dump. Set them explicitly.

**On the old install** — the same four, pointed at `frozen.obshee-delo.ru`. Until step 2 is done there, the frozen copy 301s every request to the apex, which is now the frontend, which fetches the frozen copy: a loop. `src/shared/legacy/legacyOrigin.ts` warns when `WP_LEGACY_BASE` is the site's own origin, but nothing warns about this direction. **And leave that install on PHP 7** — see §2.7.

**On the frontend** (§4.1; all read at module load, so restart — `REVALIDATE_SECRET` is the one exception): `SITE_URL` → the apex, `WP_BASE` → the new install, `WP_LEGACY_BASE` → the frozen copy, and a fresh application password for the new install, on its own service account with the §2.9 role. Then set `OD_REVALIDATE_URL` on the new install and leave the old one's unset — one WP install notifies one frontend (§4.8).

**Get the certificate for the apex and `www` onto the frontend's vhost *before* the DNS change,** not after. A wildcard is not automatically enough: `*.obshee-delo.ru` covers the subdomains above but **not the apex**, and it covers exactly one label, which is the trap §0.5 already walked into once with `stage.od.webtm.ru`.

**Then, and only then, move DNS.** Everything above is reversible by moving it back; the DNS change is the first step that the public sees.

**After the move, the social networks still hold the stage tier's card.** `og:image` is a relative path resolved against `metadataBase`, i.e. against `SITE_URL` — so every link shared before cutover carries `https://new.obshee-delo.ru/og-default.png`, and that host is `noindex` today and gone later. The platforms re-fetch on their own schedule (Telegram and ВК in days, Facebook/WhatsApp up to a month), so the apex's own links unfurl correctly from day one and only the already-shared ones are stale. Force the ones that matter — the apex, `/news/`, `/video/` and whatever the org is about to post: Telegram **@WebpageBot** (send the URL, ~10 a day), ВК `https://vk.com/dev/pages.clearCache`, Facebook/WhatsApp `developers.facebook.com/tools/debug` → Scrape Again. Yandex has no such button — it re-reads on its next crawl.

---

## 5.6 Locking the two WordPress hosts down

After cutover the apex is the frontend and **two WordPress hosts sit behind it**, neither of which should ever appear in a search result. Both end up closed, but not by the same rule and not on the same day — giving `wp.obshee-delo.ru` the frozen copy's blanket `Require ip` breaks the site, and giving it HTTP Basic breaks it differently.

### `frozen.obshee-delo.ru` — closed to everything but the frontend

Its only consumer is `loadLegacyDocument`, server-side, from the Coolify container. Nothing else — no browser, no editor, no crawler — has a reason to reach it, so shut the whole host to everything else. In its `.htaccess`, above the WordPress block:

```apache
# The A6 frozen copy is fetched server-side by the Next container and by
# nothing else. Belt: only that host may reach it. Braces: if the allowlist
# ever has to come off, the noindex still stands on its own.
Require ip <frontend VPS outbound IP>
Header always set X-Robots-Tag "noindex, nofollow"
```

**Get the IP from the container, not from DNS.** `obshee-delo.ru`'s A record is the shared-hosting front (`45.130.41.70`); the VPS's *outbound* address is a different thing and is what Apache sees:

```bash
docker exec <frontend-container> curl -s https://api.ipify.org
```

Three things to know before doing this:

- **`Require ip` is what breaks the fallback if the VPS IP ever changes** — a second replica on another host, a VPS rebuild, an egress NAT. The failure is total and silent-ish: every legacy page 404s and the log fills with `[legacy] upstream error` (§0.7). Re-run `pnpm url:check` after any move of the frontend, not just after routing changes.
- **A 301 to the apex is not an alternative to this, and would be a live bug.** `loadLegacyDocument` follows same-origin redirects up to `MAX_REDIRECTS` (`loadLegacyDocument.ts`), so a blanket `frozen/* → frozen/` 301 makes all six iframe pages render the frozen copy's *home page* at 200 — a content failure no status check sees. A 301 off-origin is refused (`upstream redirect refused` → 404), which kills the fallback outright and, pointed at the apex, builds the §5.5 loop. Neither shape removes anything from an index either: 301 says "moved", not "do not index".
- **Do not add `Disallow: /` alongside the header.** It cancels it — see the four ways `noindex` does nothing, under `wp.obshee-delo.ru` below. With the `Require ip` allowlist in place `robots.txt` is moot here anyway, since no crawler gets a response at all.

The old install's `google-sitemap-generator` will also start emitting `frozen.*` URLs after the §5.5 search-replace. Under the allowlist that is unreachable and harmless; deactivate the plugin if the allowlist is ever lifted.

### `wp.obshee-delo.ru` — `noindex` at cutover, an allowlist only later, and never HTTP Basic

Two things reach this host from a *visitor's or editor's* browser rather than from the container, and they are what rules out the frozen copy's blanket `Require ip`:

1. **Uploads from 2024 onward are served by WordPress itself.** The bucket offload is one `.htaccess` `RewriteRule` covering `wp-content/uploads/2009…2023` only (§6.4 of [`wp-backend.md`](./wp-backend.md)); 2024, 2025 and 2026 — some 700 MB — have no bucket copy. `resolveMediaUrl` falls back to the WP origin whenever its CDN HEAD probe is not a direct 200, and `resolveContentAssets` writes that URL straight into the body's `<img src>`, which the **browser** then fetches.
2. **The block editor is a REST client.** Editors need `/wp-admin/`, and Gutenberg drives `/wp-json/` from their own browsers — so neither the admin nor REST can be narrowed to the container's IP.

**At cutover, do the header and only the header.**

```apache
Header always set X-Robots-Tag "noindex, nofollow"
```

Without it the new install is a full second copy of the site's content on a crawlable host, competing with the apex for exactly the queries A8 exists to keep. **Both checks below are required, not one** — the second catches a failure mode the first cannot see:

```bash
curl -sI https://wp.obshee-delo.ru/ | grep -i x-robots-tag
curl -s  https://wp.obshee-delo.ru/ | grep -o '<meta name="robots"[^>]*>'
```

Because **`noindex` is a request, not a fact**, and it has four documented ways to do nothing:

- **`robots.txt` `Disallow` cancels it.** Google: "If the page is blocked by a robots.txt file or the crawler can't access the page, the crawler will never see the `noindex` rule, and the page can still appear in search results." Yandex says the same in one line: «Если страница запрещена в файле robots.txt, то директива метатега или заголовка не действует». Serve `noindex` *unblocked*; never pair the two. ([Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [Яндекс](https://yandex.ru/support/webmaster/ru/controlling-robot/meta-robots))
- **A permissive directive beats it, and Yandex is explicit about the tiebreak** — «Разрешающие директивы имеют приоритет в сочетании с запрещающими»: given `all` and `noindex` together, the robot takes `all`. WordPress and SEO plugins print their own `<meta name="robots">`, and `clearfy-pro` carries an SEO block, so the header from Apache and a tag from PHP are two sources that can disagree. That is what the second `curl` is for.
- **It applies only after a recrawl.** Still listed a week later is normal, not a failure.
- **The header may simply not be sent** — `Header always set` needs `mod_headers`, and PHP can override it. That is what the first `curl` is for.

**Later — not at cutover — close the host to everyone but the frontend and logged-in editors.** This is the step that does not depend on a crawler's cooperation. It is deferred deliberately: it is four rules landing on the same day the domain moves and `WP_BASE`, `WP_LEGACY_BASE`, `SITE_URL` and the certificates all change, and if images disappear afterwards nothing tells you which change did it. Give the move a week, then:

Root `.htaccess`:

```apache
SetEnvIf Cookie "wordpress_logged_in_" wp_session
<RequireAny>
  Require ip <frontend VPS outbound IP>
  Require env wp_session
</RequireAny>
Header always set X-Robots-Tag "noindex, nofollow"

# Otherwise there is nowhere to obtain a session from.
<Files "wp-login.php">
  Require all granted
</Files>
```

`wp-content/uploads/.htaccess` — a child `.htaccess` overrides the parent, which is the only way to carve an exception out on shared hosting:

```apache
Require all granted
```

**One directory is genuinely all that has to stay open.** Measured 2026-08-22 against a production build: eight pages (home, `/news/`, `/video/`, a film, `/about/`, `/contacts/`, `/materials/`, `/materials/plakati/`), each scrolled to the bottom so lazy images fired, made **24 browser-side requests to the WordPress host and every one of them was under `/wp-content/uploads/`** — no `wp-includes`, no theme assets, no ajax. Client components make no `fetch()` at all, so no form posts to WordPress from a visitor's browser either. Re-measure rather than trusting this line if the frontend ever gains a client-side call: drive those pages headless, scroll each to the bottom, and group every request whose **host** is `WP_BASE`'s by top-level path. Match on the host, not on the URL string — `/_next/image/?url=https://wp…` carries the WordPress host in its query and is a *server-side* fetch, so a substring match reports it as browser traffic and roughly triples the count.

**Never HTTP Basic for this**, however natural "password-protect the staging host" sounds. `Authorization` is one header with two consumers here: `httpClient.ts` sends `Basic base64(WP_USER:WP_PASSWORD)`, a WordPress **application password**, and Apache's own Basic would validate that same header against `.htpasswd`, where it does not appear — 401 before PHP runs, and the frontend goes blind. Putting matching credentials in `.htpasswd` only couples the rotation of two secrets. It breaks editors too: their browser would send the Apache credentials, WordPress would read `PHP_AUTH_USER` / `PHP_AUTH_PW` as an application password, fail, and answer REST 401 while their session is perfectly valid — the block editor stops saving. The IP-plus-cookie form above touches the `Authorization` header not at all.

**And be honest about what the cookie rule is worth.** `SetEnvIf Cookie "wordpress_logged_in_"` tests for the *presence* of a cookie, not for a valid session — anyone can set one, WordPress will then reject them, but Apache will have let them through. It stops crawlers and casual traffic, which is the whole job here; it is not an authentication boundary and must not be relied on as one.

**Verify the frozen copy after cutover**, before the DNS TTL expires and crawlers arrive (the two `wp.` checks are above):

```bash
curl -sI https://frozen.obshee-delo.ru/team/            # expect 403 from anywhere but the VPS
docker exec <frontend-container> curl -sI https://frozen.obshee-delo.ru/team/ | head -1   # expect 200
```

Then load a page that is still on the A6 iframe and confirm it renders — a 403 the container cannot pass turns every one of them into a blank frame, and `curl` against the apex still answers 200.

---

## 6. Launch gate — beyond this runbook

Migrating the data and pointing the app at prod is **not** launch. Still required:

- ~~**A6 legacy-page fallback.**~~ **Done 2026-08-14.** The ~170 pages are served at their live URLs through `app/legacy/[...slug]/route.ts` inside the layout's shell; gate 12 went from 83.7 % to **98.8 %** entry-traffic coverage, and a sweep over all 172 pages in the legacy sitemap found no page losing a script, keeping its chrome or leaking a link (`pnpm legacy:sweep`). It did **not** need the frozen copy: `WP_LEGACY_BASE` points at live prod and the proxy strips the chrome itself. **Three operational leaves:** set `WP_LEGACY_BASE` per tier (§4.1) and confirm the container's outbound HTTPS to it; point it at the frozen copy at cutover, because after cutover this app *is* `obshee-delo.ru` and the fallback would proxy itself — **under §0.4 the frozen copy is simply the old install on a subdomain**, so this leaf is now two `wp-config.php` lines and an `.htaccess` edit (§5.5), not a capture-and-maintain job; and the tiering in [`implementation-plan.md`](./implementation-plan.md#launch-priority) still stands for which pages deserve a native route rather than an iframe (Materials index + `plakati`/`zakladki`/`metodichki`, `/contacts/`, `/profile/[slug]`) — the pages still on the iframe are **6**, carrying 0.5 % of entry traffic and 1.6 % of pageviews (re-measured 2026-08-20 — [`page-inventory.md`](./page-inventory.md); it was 13.5 / 20.0 % over ~170 pages when this was written).
- ~~**A8 URL compatibility.**~~ **Done 2026-08-13** (`1bd016d`, `f0ac6a9`, `cbfc8d5`, `908b292`, `ea290ac`) — `/<id>` and `/video/<segment>/` are served natively, the proxy redirects the whole `/category/*` family plus the `/video/short/` and `/page/N/` shapes at one 301 each, and gate 12 measured **84.2 %** entry-traffic coverage locally with no shape failures. **Two loose ends, both operational:** re-run gate 12 against a real deploy (od-dev lacks recent posts, so five `/<id>` rows can only settle on prod), and set `SITE_URL` per tier (§4.1).
- ~~**F4 SEO baseline**~~ — **the URL-facing half is done** (`ea290ac`): `sitemap.xml` (8 248 URLs), `robots.txt`, `metadataBase` and self-referential canonicals on every route, per-page OG on the indexes. **Still open before launch: JSON-LD** (`NewsArticle` / `VideoObject` / `Organization`) and an OG image fallback.
- **A4 Yandex Metrica + consent banner** — the counter is **34478865** (read off prod's live tag). ~~**F6** 152-FZ privacy page~~ ✅ **done on prod 2026-08-13**, not ported into the repo: `/conf_politics/` is Tier 4, so the A6 fallback serves prod's own page and prod is where the text was corrected (notes §5). The СМИ registration line and 12+ badge come from od-dev widget `block-27` and are already rendered by C9's footer — but **two hrefs in that widget break on this origin**, see F6 in the plan. **A2 is decided** — Beget VPS + Coolify — but the deploy half of **A3** (docker build + push to GHCR, incl. the Dockerfile build-args in §4.7) is still open.
- ~~**B4 on-demand revalidation.**~~ **Done 2026-08-13** — both halves ship and were tested against od-dev (egress works; the mu-plugin is installed there). What is left is not a build task but two lines of per-tier config at deploy time, in §4.8: `REVALIDATE_SECRET` on the frontend and `OD_REVALIDATE_URL` on the WP install that feeds it. Skip that and editors wait an hour.
- **B8 WordPress plugin cleanup** is **not** required for the frontend, with one exception: removing `clearfy-pro` is what permanently fixes both the REST block (B1) and the WP-CLI redirect gotcha. Everything else in B8 is hygiene.

---

## 7. Rollback

**Under §0.4 the outer rollback is the DNS record.** Everything in §2 through §5 happens on an install nobody is reading, and the old one is never modified — so up to the moment DNS moves there is nothing to roll back, and after it there is one thing: point the apex back. That is the reason the model was chosen, and it makes the list below about *inner* steps only.

Inner rollbacks, in order of blast radius:

- **Frontend** — redeploy the previous image, or repoint `WP_BASE` back at od-dev. No WP state involved.
- **ACF values** — the importer only ever *fills* empty fields, so a bad import adds rather than destroys. To revert a specific film, put `-` in the offending cells and re-import (that's the explicit clear token). Keep the pre-import `film:export` sheet — it **is** your backup of prior values.
- **Cover uploads** — `film:covers` only touches posts with no featured image. To undo, unset `featured_media` and delete the `film-cover-<id>.jpg` attachments.
- **ACF field group** — deactivating the ACF plugin hides the fields from REST but leaves postmeta intact; re-activating restores everything.
- **Before starting on the new install**, take a DB snapshot through its host's panel as well as the `~/backups/` one below — belt and braces, and the panel's is the only one that survives losing the account's filesystem. (This line used to say "before starting on prod"; under §0.4 prod is the source, not the target, and needs no snapshot for our sake.)

**For the §2 preparation pass specifically, one snapshot is not enough** — that pass rewrites 5669 bodies, deletes 22 plugins and replaces core, and a single before-snapshot gives you one all-or-nothing return point across the lot. (The cheapest recovery of all is available too, and worth remembering before debugging a broken prep: **clone prod again.** It is untouched.) What od-stage used instead, and what prod should reuse (`~/od-backup.sh <slug> [--full]`, installed on `ssh timeweb`):

- One `~/backups/<NN-slug>/` per step, taken **before** the step it is named for, so `NN` restores the state that step started from. Each holds `db.sql.gz`, `files.tar.gz` and a `MANIFEST.txt` recording timestamp, core version, active theme and active plugins — the manifest is the part that makes a directory readable six weeks later.
- `--full` (whole tree) only for the baseline. The later tars carry `wp-config.php`, `.htaccess` and `wp-content/{plugins,themes,mu-plugins}` only: uploads are the bulk of the site and no step in §2 touches them. On od-stage that was 1.3 GB once and ~30 MB per step after.
- It refuses to write into an existing slug rather than overwriting, and it runs WP-CLI under PHP 7.4, so the same script works on both sides of the core upgrade.
- **The baseline is not only a rollback.** `00-baseline` is a complete un-migrated clone — tree *including* `welfare` and `cmsms-content-composer`, plus a matching dump — which is exactly what `frozen.obshee-delo.ru` has to serve for A6. Capture it before step 1 of the order table and don't tidy it away afterwards.
- **Content specifically rolls back per post,** without touching any of the above: `wp cmsms restore --post=<ids>` (or wholesale) rewrites `post_content` from `nvp_content_copy`. Which is also why that meta stays until the frontend gates pass — dropping it is the *last* item in §0.6's list, not housekeeping to do while things still move.
