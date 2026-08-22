# Next steps

Small follow-ups left behind by shipped work: something was hidden, stubbed or
postponed, and someone has to come back to it. Each entry says what was done,
why, and what has to happen next.

Bigger workstreams live in [`implementation-plan.md`](./implementation-plan.md);
this file is for the loose ends that don't deserve a workstream item.

---

## Prod is on BeGet, not Timeweb — re-verify what was measured on the twin

**Established 2026-08-15, the hard way.** `obshee-delo.ru` resolves to
**45.130.41.70**, reverse `ssl.dream.beget.com` — BeGet. The live install is
**`ssh od-root`** (`obsheedelo_odroot@obsheedelo.beget.tech`), `~/public_html`,
WP 5.5.5, `wp` at `/usr/local/bin/wp`.

`ssh timeweb ~/public_html` is a **full copy of the same site** (same siteurl,
same WP version, DB `cs16182_delo`) now serving only `общее-дело.рф`, as 301s
to the live host. Editing it changes nothing anyone can see — which is how this
was found: a first pass of the link deletions below landed there. Two cheap
tells when unsure which install you're on:

- `dig +short obshee-delo.ru` against the host's own IPs;
- make a request with a unique query string and grep `~/access_log` for it —
  on the Timeweb copy it never appears.

**Already corrected** (2026-08-15): the host tables and access section of
[`wp-backend.md`](./wp-backend.md), the prod commands and preamble of
[`prod-migration-runbook.md`](./prod-migration-runbook.md) (§2.1, §2.5's install
block, §4.6, §7), the B1 line in [`implementation-plan.md`](./implementation-plan.md),
and the outbound-HTTP note in [`implementation-notes.md`](./implementation-notes.md).

**Still open — measurements, not paths.** These were taken on the twin and
carry over only by assumption: prod's plugin inventory and versions, §2.5's
PHP/mod_php and no-`fastcgi_finish_request` notes with the save-time budget,
and the `upload_url_path` / media-offload answer. Re-run each on `od-root`
before the migration depends on it. Three places already re-verified on BeGet:
`clearfy_option.disable_json_rest_api` is still `'on'`,
`wp --skip-plugins --skip-themes` is still the invocation that works, and
**WP Rocket is active and serving cached HTML on the live host** — established
2026-08-22 off the page footer (`Debug: cached@…`), which retires the
«BeGet was not inspected» half of the old Timeweb observation. The consequence
is a step, not a note: **a `wp eval-file` that edits terms leaves stale HTML on
every cached URL**, and `--skip-plugins` means Rocket is not even loaded to
notice. Purge what you touched afterwards —
`wp --skip-plugins=clearfy-pro --skip-themes eval 'rocket_clean_post( <id> );'`,
which takes the post's own page *and* its category archives — or leave it, if
nothing on those pages is urgent.

The A6 frozen copy is unaffected — it's `WP_LEGACY_BASE`, not a WP-CLI target.

---

## Footer link «Благотворительная акция» (`/sp/`) — deleted 2026-08-15

**Done at the source, on both tiers.** Not hidden in the frontend any more —
the frontend guard that briefly existed (`HIDDEN_HREFS`) is gone with it.

| Tier | What was deleted | How |
| --- | --- | --- |
| **prod** (BeGet, `ssh od-root`) | the `<li>` in `widget_text[3]` («ССЫЛКИ», `sidebar_bottom`, instance `text-3`) — 9 `<li>` → 8 | `wp eval-file` + `rocket_clean_domain()` |
| **od-dev** | the `wp:list-item` block in widget `block-32` (`sidebar_bottom`) — 8 links → 7 | REST `PUT /wp/v2/widgets/block-32` |

To restore, paste the markup back into that list (Gutenberg form on od-dev,
bare `<li>` on prod):

```html
<!-- wp:list-item -->
<li><a href="/sp/">Благотворительная акция</a></li>
<!-- /wp:list-item -->
```

`/sp/` itself still answers 200 and stays reachable through the A6 legacy
fallback; only the link is gone.

**Why.** `/sp/` carries a leyka donation form posting to this WordPress's
`/leyka-process-donation`, and that path has taken no money since 2022-01-05;
donations run on `donation.obshee-delo.ru` and `поддержи.общее-дело.рф` (both
live). Inside the A6 iframe the form is doubly dead — the visitor gets no
error, just nothing, the same failure mode as the newsletter form (#54).

**Measured 2026-08-15:** 1 of 172 legacy pages carries a leyka form (only
`/sp/`) · 1 link to it in all WP menus and widgets · 65 pageviews / 1 entry
visit in 91 days (Metrica, 2026-05-14 → 2026-08-13) — i.e. the pageviews *are*
the footer clicks that were removed.

**Next:**

1. Ask the org whether the «ПРАВИЛЬНЫЕ решения» campaign is still running (the
   page has a budget table, so it was time-boxed).
2. Decide which donation destination is canonical — `donation.obshee-delo.ru`
   or `поддержи.общее-дело.рф`. Both answer 200; the legacy page links the
   second.
3. Then pick for `/sp/`: **301** it to that destination (cheapest) · **put the
   link back**, pointing straight at it · or **rebuild the page natively** with
   an outbound donate CTA, if the campaign is live and the content is worth
   keeping.
4. Then decide leyka — open item 9 under B-PLUGINS in the plan. If donations
   never come back to this WordPress, leyka and its `leyka_donation` /
   `leyka_campaign` CPTs go at plugin cleanup.

**Rule that outlives this entry:** donations must not be routed back through
WordPress — same reasoning as [`newsletter-unisender.md`](./newsletter-unisender.md).
Before assuming `/sp/` is still the only such page, re-scan: pull
`page-sitemap.xml` and grep each page for `leyka-pm-form`.

---

## Nav item «Заказать материалы» — deleted 2026-08-15

**Done at the source, on both tiers**, so the frontend no longer filters it:
`ЗАКАЗАТЬ МАТЕРИАЛЫ` is out of `HIDDEN_LABELS` in
[`src/shared/config/navOverrides.ts`](../src/shared/config/navOverrides.ts),
which now holds only «ОБЩЕЕДЕЛО-ПРО».

Menu item **27971** — the same id on both installs — was a child of «МАТЕРИАЛЫ»
(parent `20181`, `menu_order` 26) in menu **39** (`footer-navigation`, location
`primary`, the site's main nav), pointing at page **22125**,
`/materials/order-materials/`. Menu 39 went 40 items → 39 on each. Deleted with
`wp menu item delete 27971` on prod and `DELETE /wp/v2/menu-items/27971?force=true`
on od-dev. To restore: re-add page 22125 to menu 39, parent «МАТЕРИАЛЫ»,
position 26.

**Why.** The page is a Contact Form 7 order form, and CF7 mail from this host
lands in spam — the same "quietly lost, not visibly broken" path documented in
[`newsletter-unisender.md`](./newsletter-unisender.md).

**The page went too, 2026-08-17.** Deleted on prod, trashed on od-dev
(`wp post delete 22125`), and its entry dropped from
[`legacyEmbedPages.ts`](../src/shared/config/legacyEmbedPages.ts) — in that
order, because while the od-dev copy was still published, removing the entry
first would have rendered it natively. `/materials/order-materials/` now 404s,
so the restore note above no longer applies as written: bringing the nav entry
back means recreating the page first. The one page that linked to it,
`/materials/disk/`, is cleaned on both tiers.

**Next:** it comes back only with a delivery path that works — the form wired
to something other than host mail, or the page replaced by an address people
can write to. Same decision as the contact forms in that doc; do them together.

---

## Nav item «ОБЩЕЕДЕЛО-ПРО» — deleted 2026-08-15

Deleted on both tiers, which retired the last entry in `HIDDEN_LABELS` and with
it the whole `shared/config/navOverrides.ts` module and its test —
`toNavItems` now takes the menu exactly as WordPress sends it.

Menu item **56658**, top-level in menu **39**, `menu_order` 39, a `custom` link
whose URL differed per install — `https://od-pro.ru/` on prod,
`https://общеедело-про.рф` on od-dev (the label was what matched both). Menu 39
went 39 items → 38 on each. To restore: re-add a custom link with that label
and the install's own URL, at the end of the menu.

**Why:** a sibling property this site doesn't advertise. It had been filtered
in the app since the header was built; deleting it at the source is the same
decision, made once, where editors can see it.

⚠ **The banner slider on prod's home page still links `od-pro.ru`** — an
`allinone_bannerWithPlaylist` slide («Проекты. Развитие. Общество.»), untouched
because it wasn't in scope. If ОБЩЕЕДЕЛО-ПРО is meant to disappear from the
site rather than just from the nav, that slide is the other half.

---

## The WordPress editor is not WYSIWYG — deferred 2026-08-17

**What's true today.** The design system's CSS lives in this repo, nested under
`.gutenberg` and loaded only by the Next app ([`wp-page-redesign.md`](./wp-page-redesign.md)).
WordPress is headless and loads none of it, so the block editor shows a page in
default Gutenberg styling — right structure, wrong everything else. An editor
choosing between two layouts is choosing blind and has to check the result on
the frontend.

**Why it was left.** Through workstream D the pages are built by us, from Figma
mocks, with the browser open — so the person editing already sees the real
thing. The cost only lands when editors start authoring pages themselves.

**What it would take**, cheapest first:

1. **Serve the compiled Gutenberg CSS at a stable URL** from this app (a copy in
   `public/`, since Next hashes its own CSS filenames) and enqueue that URL in
   `od-design.php` on `enqueue_block_editor_assets`. Cross-origin stylesheets
   need no CORS, so this is two lines on each side.
2. **The scope root is the catch.** Our rules are nested under `.gutenberg`; the
   editor wraps content in `.editor-styles-wrapper`, so nothing would match.
   Either emit a second build with both roots, or add `.editor-styles-wrapper`
   as an alias in `gutenberg-provider.css`. `add_editor_style()` rewrites
   selectors for classic editor styles but will not fix a nested root.
3. **It is a copy, and copies drift.** Whatever ships has to be produced by the
   build rather than pasted, or the editor will eventually preview a design the
   site no longer has.

**Trigger to do it:** the first page an editor is expected to lay out without
us. Until then, the frontend is the preview.

---

## ~~`WpPage` breadcrumbs start at «Главная», the mocks start at the parent~~ — done 2026-08-18

**Closed with D6j** (`af2bfd0`), and this entry outlived it by two days —
`fetchWpPage` requests `parent`, `fetchAncestors()` walks it outermost-first with
a three-level cap, a level that fails to load ends the trail instead of failing
the page, and `WpPage` renders «Главная › …ancestors › this page». A page in a
tabbed section still names its own trail (`pageSections.ts`), which is what
`/team/` needs, sitting at the WP root while belonging under «О нас».

The description of the problem, kept because it is why the shape is what it is:

**Found 2026-08-17**, redesigning `/materials/metodichki/`. Figma `handbooks`
draws «Материалы › Методические пособия»; `WpPage` rendered «Главная ›
Методические пособия», because it built the trail from two literals — the root
and the page's own title. Every one of the ~150 native WP pages was the same, and
every mock in a section shows its parent.

**Why it wasn't done with that page.** The data is there — page 27642's
`post_parent` is 20225 (`materials`) — but `fetchWpPage` doesn't request `parent`,
and a trail needs each ancestor's *title*, so a deep page is one extra request
per level (or one `?include=` request once the ids are known, which needs the
chain first). That is a `WpPage` change affecting every native page, and it does
not belong to one page's commit.

**What it would take:** add `parent` to `fetchWpPage`'s `_fields`, walk it with a
`cache()`d `fetchWpPage`-by-id, cap the depth (nothing on od-dev is deeper than
two), and fall back to today's «Главная» when a parent is missing or unpublished.
The crumb should link the parent's own path, which for `materials` is a native
route already.

---

## ~~`.wp-block-group h2` lowercases «Россия»~~ — done 2026-08-20

**Found 2026-08-17.** `gutenberg.css` had
`.wp-block-group h2 { text-transform: lowercase }` with a `::first-letter`
override, which sentence-cased the all-caps headings WordPress content is full
of — and lowercased every *proper noun* after the first word with them.

**Measured before fixing it**, which is what the entry was waiting for:

| | all-caps (what the rule was for) | a capitalised word past the first (what it broke) |
| --- | ---: | ---: |
| 169 published **pages** | 8 headings | **26 headings on 16 pages** |
| 600 sampled **posts** | 50 headings | **0** |

And the eight all-caps page headings are all on `/тестовая-страница/` and on the
`/video/` page a native route shadows — so **on pages the rule protected nothing
at all**, while «Здоровая Россия — ОБЩЕЕ ДЕЛО!» rendered «Здоровая россия —
общее дело!» on a page anyone can read. On posts the opposite: it is the only
thing standing between the reader and 8 % of bodies shouting.

**So the fix was neither "delete the rule" nor "sentence-case the content".** The
distinction the rule cannot make — *does this text carry casing information at
all?* — is one line of code and no lines of CSS:
`resolveHeadingCase` in the content pipeline lowercases a heading only when its
text has **no lowercase letter**, and leaves every other heading exactly as
authored. It sits in `resolveContentHtml` with the asset and link passes, so it
covers pages, posts, films and the footer alike, and needs nothing run against
production. The CSS rule is deleted.

Verified in a browser at 1440: `/healthy-russia/` now reads «Здоровая Россия —
ОБЩЕЕ ДЕЛО!», post 72880 still reads «Елена колесникова в новом созыве…».
Entities and markup are held out of the casing pass — `&laquo;` must not become
`&Laquo;`, and a heading that opens with a link must not capitalise its `a`.

---

## Profile 46651's slug names a different person

**Found 2026-08-17.** The record titled «Андрей Алексеевич Рязанов» has
`post_name` `гордикова-екатерина` (percent-encoded) and `_wp_old_slug`
`екатерина-гордикова`: it was Екатерина Гордикова and was retitled in place
without re-slugging. `/materials/metodichki/` now links it, so the wrong name is
visible in the href.

**Now fixable, and it was not before.** `/profile/[slug]` became a native route on
2026-08-19, so the A6 iframe — which is keyed on the frozen copy's **live** paths
and would have 404'd on a re-slug — is no longer in the way. What re-slugging still
needs is a redirect from the old path: WordPress writes `_wp_old_slug` on rename,
and nothing on this frontend reads it yet.

**Also: 46651 is unlikely to be the only one.** Worth a pass comparing each
`profile`'s title against its slug once D3 starts — 139 records, and the
mismatches are the ones whose URLs are wrong for search too.

---

## ~~The three `metodichki` covers are the wrong image files~~ — done 2026-08-18

**Found 2026-08-17, closed 2026-08-18 with the mock's own artwork.** Figma
`handbooks` shows flat poster artwork; WordPress held photographs of the printed
booklets on white grounds, which is what the live site has always shown.
`.od-covers img` crops to the mock's 387×546 with `object-fit: cover`, so the row
was even either way — but each card carried a band of the photo's own white
background where the mock has artwork to its edges.

Design's answer was that the flat covers are fine, so the three rects
(`779:4396` / `779:4398` / `779:4400`) were exported at scale 2 — **775×1092
each, exactly the row's 2× density and exactly its 0.7097 ratio, so nothing
crops** — written to JPEG at q88 (≈190 KB each), committed at
`wp/assets/metodichki/` and uploaded to od-dev. `OD_METODICHKI_COVERS` in
`od-pages.php` now swaps all three, and `od_cover_full_size()` learned to take a
**root-relative path** and not just a basename, because an upload of ours does
not sit in the directory the page already carries.

**Three consequences, all recorded where they bite.** The exports are the
*frame's* crop rather than the print file — cover 3 loses the top of «МОЛОДЕЖЬ»,
exactly as the mock draws it, and cover 2's «ОПАСНОЕ ПОГРУЖЕНИЕ» sits under the
pill. The files serve from the WordPress origin, not the media bucket, because
nothing in this install offloads on upload (`resolveMediaUrl`'s
301-means-absent fallback is what makes that a non-event). And production needs
the same three files at the same `wp-content/uploads/2026/08/` path **before**
`od-pages.php` runs there, or the swap matches nothing and says nothing —
[`prod-migration-runbook.md` §2.8](./prod-migration-runbook.md).

**What this replaced, for the record.** All three rendered at 386.67px wide from
naturals of 500 / 220 / 297 px (**1.29× / 1.76× / 1.30×** upscale) because the
page referenced deliberately small uploads. «Здоровые дети» was the one with no
way out: its `<img>` claims `wp-image-27636`, but 27636 is a **different
booklet** (`2016/03/metodichka-mult.jpg`, 844×1092, on the bucket and serving
fine — the light-blue «ПРОГРАММА» cover, not the dark «Тайна едкого дыма» one the
row shows). The picture the row showed belongs to attachment 36624, whose only
file is a 220×300 export somebody uploaded as the original; every `metodic*` /
`mult*` attachment in the library was checked and 220×300 was the ceiling.

The same question was open for `/materials/plakati/` and `/materials/zakladki/`
and has the same answer now: export the mock's artwork.

## ~~The covers' `alt` carried the site's own name~~ — done 2026-08-18

`od_strip_site_suffix()` / `od_strip_attr_site_suffix()` in `od-pages.php`. The
old theme's headings ended in « - ОБЩЕЕ ДЕЛО» because they doubled as the link's
`title`, and `od_headings_into_image_alt()` copied that into three `alt`s, from
where `od_cover_link_names()` copied it into three `aria-label`s — a screen reader
read the site's name out three times between the covers. The attribute-level
strip exists because the heading-level one cannot reach a page that was already
converted: it is idempotent by «the heading is gone afterwards».

## ~~The first cover was lazy-loaded~~ — done 2026-08-18

WordPress marks every image in a body `loading="lazy"` at render time, the LCP
element included. `resolveContentHtml(html, true)` — passed by `WpPage`,
`NewsArticle` and `FilmPage`, not by the footer — makes a main body's first image
`loading="eager" fetchpriority="high"` and leaves the rest lazy.

## Three unauthenticated PHP entry points are live on production

**Found 2026-08-18** while removing `cmsms-content-composer` from od-dev. The
plugin ships three files that bootstrap WordPress themselves from
`$_SERVER['SCRIPT_FILENAME']` instead of going through `admin-ajax.php`, and read
`$_POST` with no nonce and no capability check:

```
wp-content/plugins/cmsms-content-composer/framework/inc/cmsms-composer-templates-operator.php
wp-content/plugins/cmsms-content-composer/inc/project/projects-loader.php
wp-content/plugins/cmsms-content-composer/inc/post/posts-loader.php
```

All three answer **200 on `https://obshee-delo.ru/` today** to an unauthenticated
request. **Deactivating the plugin does not close them** — a deactivated plugin's
files are still served; measured on od-dev, where all three kept returning 200
until the directory was deleted, and 404 immediately after.

**What to do:** delete the plugin directory on prod. That is already step 3 of
[`prod-migration-runbook.md` §2.6](./prod-migration-runbook.md), so this needs no
separate work — but it is worth doing on its own schedule rather than waiting for
the cutover, since it is live exposure on the public site. It costs nothing: the
theme keeps the plugin as a `.zip` for reference, and `cmsms-gutenberg-upgrade`
never calls into it.

While looking: `wp-content/plugins/wp-optimize/vendor/mrclay/minify/server-info.php`
is a second self-bootstrapping file, from a different plugin. Unchecked — worth
one `curl` when someone is in there.

## 1 492 rows the cmsms deactivation orphaned

**Measured 2026-08-18**, right after `cmsms-content-composer` was switched off on
od-dev. Its other post types were not re-registered — deliberately, they are dead
— so their rows are still in the database and no longer reachable from the admin:

| post type | rows | referenced by anything published? |
| --- | --- | --- |
| `cmsms_like` | 1 430 drafts | no — engagement counters for a theme we don't render |
| `content_template` | 41 published | no — checked every published page and post |
| `project` | 21 drafts | no — 0 published, the recon found Lorem ipsum |

**What to do:** nothing urgent. If the database is ever tidied, delete them with
`wp post delete --force` per type, and take the dead `cmsms_*` postmeta with them
— **except `cmsms_profile_subtitle`**, which `wp/mu-plugins/od-profile.php`
re-registers and D3 reads. Worth doing before a prod dump/restore, not before
launch.

## 38 orphan tables from deleted plugins — and one of them is a live mailing list

**Measured on od-stage 2026-08-21**, the prod clone, after the headless prep
deleted 22 plugins ([`prod-migration-runbook.md` §0.6](./prod-migration-runbook.md)
step 04) and after the dead-meta sweep took 215 469 rows out of `wp_postmeta`
(item 10 there). The tables those plugins created are still in the database —
**40 non-core tables, 38 of them orphaned** — and they were deliberately *not*
dropped, because reading them first turned one of them into a decision.

**The one that matters: MailPoet 2 (`wp_wysija_*`, 16 tables).** The plugin is
long deleted, and the list is not dead:

| | rows |
| --- | ---: |
| `wp_wysija_user` — subscribers | **10 954** (5 249 confirmed, 5 705 not) |
| `wp_wysija_user_list` — memberships | 11 354, across 3 lists |
| `wp_wysija_email` — campaigns ever sent | 3 |

Two facts from the same table decide what happens next. **It is still being
written to:** the newest `created_at` is **2026-08-20 11:25**, the day the clone
was taken, and **830 addresses arrived in the last year** — so the signup form on
the live site works and people are still using it. And **nothing was ever mailed
to them**: `last_opened` is `NULL` on all 10 954 rows, against three campaigns in
ten years (the oldest subscriber is from 2016-05-04).

**So the cutover silently ends a thing the current site does.** MailPoet goes
with the plugin prune; `NEWSLETTER_SIGNUP_ENABLED` is `false` in
`src/shared/config/features.ts` and `NewsletterSignup`'s `handleSubmit` only
calls `preventDefault()` (wiring is issue #54 / B6). After the domain moves there
is no subscription form at all, and the 830-a-year stream stops. That is a
product decision, not a database chore.

**What to do, in this order:**

1. **Export `wp_wysija_user` + `wp_wysija_user_list` before anything is dropped.**
   It is the only copy, it is 10 954 real addresses with IPs and names, and that
   makes it personal data under 152-ФЗ — so the export needs a home as careful as
   the site's own backups, not a CSV in a scratch directory.
2. **Decide where the newsletter lives** — B6's form backend, an external sender,
   or an explicit «we don't do this any more» and the form stays hidden. Until
   that is answered the export is the only thing standing between the list and
   the prune.
3. **Then drop the tables.** The other 22 are safe and merely large: nothing can
   reach them without the plugin that made them, and none of it is editorial.

| tables | rows | what it was |
| --- | ---: | --- |
| `wp_ewwwio_images`, `wp_ewwwio_queue` | **428 675** | EWWW image-optimiser cache — derived data, regenerable by definition |
| `wp_revslider_*` ×7, `wp_layerslider` ×2 | ~170 | slider content for two plugins that are gone; the pages that used them are migrated |
| `wp_actionscheduler_*` ×4 | ~50 | WooCommerce's scheduler; Woo's own tables went in §0.5 |
| `wp_wpr_rucss_resources`, `wp_wpr_rucss_used_css` | — | WP Rocket's used-CSS cache |
| `wp_hugeit_lightbox`, `wp_all_in_one_bannerWithPlaylist_*` ×4 | ~75 | a lightbox and a banner-playlist plugin |

**`wp_leyka_donations` and `wp_leyka_donations_meta` stay** — leyka is one of the
two plugins that remain active, and those rows are donation records.

Note for whoever runs it: a single `DROP TABLE` naming all 22 is one
irreversible statement over a database, and it is worth doing per family with a
`~/od-backup.sh` snapshot in front of it rather than in one line.

## ~~Linkify the contacts inside `profile` bodies — the other 128~~ — done 2026-08-20

**Eleven were done with D3** (2026-08-18): `od_canonical_tel_links()` in
`od-pages.php`, over the `/team/` records only. **The sweep is now done too** —
`od_pages_profile_contacts()` over the whole post type, which is what the new
`sweep` registry key is for (see [`wp-page-redesign.md`](./wp-page-redesign.md)).
Two halves were added beside the phone one: `od_mailto_links()` and
`od_social_links()`, and all three now go through one `od_replace_unlinked()`
walk, so a pattern only ever sees text a reader sees — never an attribute, never
the inside of an existing anchor.

**Measured on od-dev, before and after the apply** (142 published records, not the
139 of 2026-08-18):

| | before | after |
| --- | ---: | ---: |
| records whose card shows a **phone** row | 32 | **106** |
| … an **e-mail** row | 108 | 113 |
| … a **social** row | 44 | 45 |
| records showing at least one contact | 113 | **122** |
| records with a phone typed as plain text | 75 | **1** |

90 of the 142 records changed; a third run reports no change at all. The frontend
did not change — `parseProfileBody` still reads anchors only, by scheme and host,
which is the point: the fix belongs in the content, and this is the alternative to
backfilling ACF fields ([`wp-backend.md` §3.1](./wp-backend.md)).

**Why «at least one contact» only moves 113 → 122.** Most records with a
plain-text phone already showed an *e-mail* row, so they gain the phone rather
than their first row; the 20 that still show nothing hold no contact anywhere in
the body, which is a content question and not this one.

**The one number still unlinked** is record 64752's: `тел.: 8 (914) <span
class="wmi-callto">255-87-86</span>` — a webmail artifact splits it across a tag,
and a pattern that spanned markup would be a pattern that links things it should
not. One record of 142; leave it to whoever unwraps those spans.

**E-mail and social patterns are ASCII-only on purpose.** `\w` under `/u` matches
Cyrillic, so the obvious pattern turns «напишите@нам.рф» — and any Russian
sentence with an @ in it — into a link. Both are asserted.

## ~~Three team cards show a contact the team page does not~~ — decided 2026-08-19

Raised while building `/team/`: three of the eleven cards show one row more than
Figma draws — Варламов's `obshee.delo21@gmail.com` beside the
`l.varlamov@obshee-delo.ru` the live page gives, Васильев's regional
`pskov@obshee-delo.ru` beside the team's `pro@obshee-delo.ru`, Чагаев's
`+7-495-722-53-29` landline above his mobile.

**Answered: keep them all.** Where a record and a page disagree the union is what
ships, because neither source is provably current and the mock is not a data
source. It is the same rule the roles follow — the federal one and the regional one
both go on the card. If the client ever prunes a contact, it is one line each in
`od-pages.php`; nothing needs a code change to *show* it.

## Eighteen branch cards state no way to reach anybody — and prod's page set is not od-dev's

**Found 2026-08-20**, reading all 75 finished cards, and it turned into two
findings.

**The cards.** 19 of od-dev's regional bodies hold only the branch's legal name:
the accordion they were built from says «Адрес офиса:», «тел.», «e-mail:» with
nothing after them. That is the data, not the transform — checked against each
page's pre-conversion revision. **But an empty card is not an empty page**:
`/contacts/arkhangelskaya/` lists 8 coordinators and 50 events under its empty
card, and every one of the 19 except `/contacts/evreiskaya-ao/` lists events.
So only that one was drafted (`od_wp_draft_empty_branches()` in
`wp/scripts/od-wp.php`, which requires no contact **and** no coordinator **and**
no event), and the other 18 are a content gap: somebody has to fill in the
telephone numbers, or the branch has none to give.

The 18: Астраханская · Ивановская · Калужская · Курская · Мурманская ·
Оренбургская · Орловская · Пензенская · Мордовия · Северная Осетия (which does
name a coordinator, with no way to reach him) · Чечня · Чувашия · Рязанская ·
Смоленская · Тюменская · Украина · Чукотский АО · Хабаровский край, plus
Архангельская.

**The page sets.** Counted on production the same day, read-only: the `/contacts/`
subtree has **58 published children and 2 drafts** there against od-dev's 74, and
the difference runs both ways — production publishes `rezan-oblast` and
`smolenskaya-oblasti` (which od-dev 404s, and which [`page-inventory.md`](./page-inventory.md)
had written off as slugs that never existed), while od-dev carries ~16 regional
pages production has never had. Emptiness differs too: **5 empty cards on
production**, and od-dev's `khakasiya` has contacts production's does not.

**What to decide:** whether od-dev's extra pages are drafts of work in progress or
stale copies. It matters for the cutover only in one direction — the launch runs
against production's page set — so the safe reading is that anything measured on
od-dev is the *shape* of the work, not the shipping list. Also worth knowing while
working on prod: its CLI `php` is **5.6** (`wp` runs under it; `/usr/local/bin/php8.2`
exists), and its WordPress is still 5.5.5, which cannot render a `core/query`
block at all — so the coordinator loops and «События» that od-dev draws are
invisible there until the core upgrade in the runbook.

## Twelve regions on the map have no page, and five pages have no region

**Found 2026-08-20**, building the `/contacts/` map (D4). The map is generated
from the old jqvmap plugin's paths and links each region to its published page —
which makes both gaps visible for the first time, and neither is a code question:

- **12 regions are drawn and not clickable** because no `/contacts/<region>/`
  page exists: Дагестан, Кабардино-Балкария, Карачаево-Черкесия, Адыгея,
  Липецкая, Калининградская, Саратовская, Марий Эл, Курганская, Ненецкий АО,
  Республика Алтай, Ингушетия. Publish a page and `pnpm map:generate` links it
  with no other edit.
- **5 pages have no region to click**: `/contacts/ukraine/`, `lnr/`, `dnr/`,
  `belarus/` — outside a map of Russia — and `/contacts/moscow/`, which is
  «Центральный Аппарат» rather than a subject. All five are in the accordion, so
  they are reachable; only the map cannot show them.

Also found on the way: the old map still routed Saratov Oblast to
`/contacts/saratovskaya/`, **a page that no longer exists** — a live 404 on the
page being replaced. That case is dropped rather than carried over.

**What to decide:** whether the twelve are regions with no branch (then nothing
to do) or branches with no page (then the pages are missing). The map is
regenerable either way.

## ~~`/contacts/samarskaya/` lists no coordinators, and the term exists~~ — done 2026-08-20

**Found 2026-08-18.** Page 21557's `core/query` block still carried the old
`taxQuery: {"post_tag": [-1]}` placeholder — the "match nothing" fallback from
before [`wp-page-passthrough.md` §5a](./wp-page-passthrough.md) was fixed. It is
**the one page of the 75 the re-migration could not touch**: its
`nvp_content_copy` backup is empty, so `wp cmsms migrate` had no original
shortcode to convert. Meanwhile the right term was there all along —
`activity-samara` (`pl-categs` 532) with **8 profiles**.

**Fixed as a registry entry**, `od_pages_samarskaya_coordinators` in
`wp/scripts/od-pages.php`, applied on od-dev: the page now renders its 8
coordinators above the 12 «События» posts. The term id is resolved by the runner
from the slug — `pl-categs` ids are per-environment, so a literal would have been
wrong on the next install — which is what the new `taxonomy` key on a registry
entry is for (`tag` used to mean `post_tag` and nothing else).

**The four pages with the same placeholder are a different case** and were left
alone; see the entry below. Production gets this with the rest of workstream D,
in one `wp eval-file` run.

## Four regional contact pages point at the wrong region, and always did

**Found 2026-08-18.** `/contacts/murmanskaya/`, `smolenskaya/`, `mordoviya/` and
`astrakhanskaya/` each carry `taxQuery: {"pl-categs":[-1]}`, correctly: their
original shortcode read `categories="архангельская-область"` — a copy-paste on the
legacy site, which rendered them empty too. And `pl-categs` has **no term at all**
for Murmansk, Smolensk, Mordovia or Astrakhan, so there is nothing to repoint them
at. 20 of the 72 terms have zero profiles.

**What to do:** a content question for the coordinators, not a code fix — either
those four regions have contacts to tag or the pages should stop implying they do.

## ~~Icons carry no `aria-hidden`, app-wide~~ — done 2026-08-20

**Found 2026-08-18, closed with the one line it was always going to be:**
`svgProps: { 'aria-hidden': 'true' }` in the svgr loader options in
`next.config.ts`, mirrored in `vitest.config.ts` so a test sees the rendered
attribute. It covers the components in `Icons/index.tsx` *and* the three that
import an SVG straight from `assets/icons/` (`Accordion`, `ButtonGroupItem`,
`Breadcrumbs`), which a change to the wrappers would have missed.

**The precondition was checked first, and it held:** every icon-only control on
the site already carries its own `aria-label` — `Carousel`'s two `IconButton`s,
`Pagination`'s prev/next links, the header's search and menu buttons, and the
footer's three social links (`renderFooterWidget` supplies theirs). So nothing
lost an accessible name. `Icons.test.tsx` asserts the default and asserts that
`aria-hidden={false}` at a call site still wins, which is what makes an app-wide
default safe — svgr spreads the caller's props after its own.

## Two footer/heading semantics gaps outside D8

**Found 2026-08-18** while auditing `/materials/metodichki/` in a production build:

- ~~The footer's social row is a `<h2 class="wp-block-heading">` **with no text**,
  wrapping three icon links — an empty heading in the a11y tree.~~ **Done
  2026-08-20**, in `renderFooterWidget`: a heading with no text of its own is
  rendered as a `div` carrying the same class, so `Footer.module.css` still lays
  the row out and the empty heading is gone from every page. Fixed on this side
  rather than in the widget because the markup is an editor's and would come
  back on the next save.
- ~~`/contacts/<region>/` pages go `h1` → **`h3`** (the coordinator teaser's title)
  → `h2` «События».~~ **Done 2026-08-20** by dropping the level, not by adding a
  heading: `od_pages_coordinator_heading_level` in `od-pages.php`, a `sweep`
  scoped to the `/contacts/` subtree plus `/khabarovskiy/`, the one regional page
  outside it. Measured before the fix: **71 of 169 published pages** went `h1` →
  `h3` with no heading in between. A «Координаторы» heading block was the other
  option and was dropped — it would put words on 74 pages no mock asks for.
  **Two things came with it.** `gutenberg.css` sizes `h2` one step larger than
  `h3` *and* lowercases every `h2` inside a group, so
  `.wp-block-post-title.wp-block-post-title` there now pins a card title's size
  and case at any level — verified in a browser at 1440 (28px,
  `text-transform: none`). That rule also reaches the «События» cards on the same
  pages, which were `h2` all along and *were* being lowercased («общее дело» в
  самарской школе); they now read correctly and one size smaller. And
  `/contacts/dnr/` still skips a level on its own — a literal `<h3>` branch name
  under the `h1`, one page, untouched.

## The 25 «Истории активистов» clips are on YouTube, not Kinescope — upload them

**Checked 2026-08-19, twice.** `/about/activist-stories/` (D6r) embeds 25 clips,
all of them YouTube. They were matched the way D6n's film mapping was built —
each embed resolved through YouTube oEmbed, every resulting title compared
against all **262** videos in the Kinescope account — and there are **zero**
matches, exact or partial. Searching the library for `Отзыв` and for the
surnames (`Свиридов`, `Моисеев`, `Гурин`, `Нигматянов`) returns nothing either.
The library holds films and cartoons; these testimonials were never imported.

**What has to happen:** upload the 25 to Kinescope, then swap the embeds. The
page keeps them in `core/embed` blocks, one per row, so the swap is a
`od_pages_activist_stories()` re-run against a slug→`kinescope_id` list — the
same shape `film:kinescope` already produces for films, and the same reason:
YouTube is not ours, Kinescope is. Until then the embeds stay as they are, and
they work.

Worth doing together with **B-VIDEO2**, which is blocked on the same kind of
editorial input, and after it if capacity is short — B-VIDEO2 is a Tier 0
blocker and this is not.

## `/about/`: the statistics site, «СМИ о нас»'s borrowed drawing, the private «Наши отчеты», and the missing H1

**Found 2026-08-19**, building `/about/` (D6w), and revised **2026-08-20** on
review. Four loose ends, none of them blocking, all of them decisions the frame
cannot settle on its own.

**The statistics card is out until the statistics site is rebuilt.** «Наша
статистика» pointed off-site at `общее-дело.рф`'s statistics host
(`xn--80a7adb.xn----9sbkcac6brh7h.xn--p1ai`), and the card came off the section
index on 2026-08-20 because that site is dated enough that linking it from here
undersells the organisation. The idea, and the reason this is written down: **give
the statistics site a refresh, then put the card back** — it is one row in
`OD_ABOUT_CARDS` plus a `::before` rule, and `direction-2.svg` is the drawing it
had. Nothing else on this side needs to change.

**The nav menu item went too** (2026-08-20), so the two agree: «Наша статистика»
under «О НАС» is a row in `od_wp_menu_edits()` in `wp/scripts/od-wp.php`, matched
by its label because its url is a bare domain and its *path* is `/` — the same
path «ГЛАВНАЯ» has. Bringing the card back therefore means three edits, not one:
the row out of `od_wp_menu_edits()`, the menu item added back in WordPress (the
script only deletes), and the card and its `::before` rule back.

**«СМИ о нас» draws `/materials/`'s «Статьи» illustration.** It is the one card
left with no drawing of its own: Figma `about` supplies seven, and the mock has no
card for `/about/smi/`. The borrowed file is portrait (200 × 200), so it stands as
tall in the card's 200 × 230 box as the four exported ones beside it — which is
why it is that file and not one of the landscape `direction-*` drawings the four
dropped cards used to borrow (**335 × 194**, and `contain` gave them 200 × 116,
half the height of their neighbours). Ask Design for a drawing of its own; the
size problem is fixed either way.

**The mock's «Отчеты» card has no page to point at.** `reports` («Наши отчеты»,
id 31658) is `private` and was last edited **2017-04-26**. Its calendar drawing
went to «Документы» (`/about/docs/`), which is where the annual reports actually
are. If the reports page is meant to come back, it needs content and publishing
first, and then it is one row in `OD_ABOUT_CARDS`.

**The frame draws no breadcrumbs and no H1.** `WpPage` renders a `PageHeader` on
every WordPress page, so `/about/` has «Главная › Об организации» and a red
«ОБ ОРГАНИЗАЦИИ» that the mock does not. It was kept: a 1 036-view page with no
heading at all is an SEO regression, and suppressing it would need a per-page
exception in `pageSections.ts`. Worth a sentence with Design — the same question
applies to `home`, which also draws none and is a native route that renders none.

---

## Contact Form 7 is five years behind on prod, and prod's REST is switched off

Recorded 2026-08-20 while answering "what is the отзыв form built on". Nothing
was changed — this is the version state, where the plugin is actually used, and
what has to be updated or dropped.

**The versions.** Prod (`od-root`) runs **CF7 5.4.2**, released July 2021, on
**WP 5.5.5 / PHP 7.4.33**. Upstream is **6.1.7** (2026-08-17). `wp plugin list`
reports `update: none`, and that is truthful rather than broken — every later
CF7 raises its `Requires at least` above this core:

| CF7 | Requires WP | On WP 5.5.5 |
|---|---|---|
| **5.4.2** (installed) | 5.5 | the last version that fits |
| 5.5.x | 5.7 | no |
| 5.6.x | 5.9 | no |
| 5.7.x | 6.0 | no |
| 5.8.x / 5.9.x | 6.2 / 6.3 | no |
| 6.0.x / **6.1.7** | 6.6 / 6.7 | no |

There is no 5.4.3 — the tag 404s on plugins.svn, so 5.4.2 is the end of that
branch and no back-patch is coming. Taken from
`plugins.svn.wordpress.org/contact-form-7/tags/<v>/readme.txt`, not from memory.

**So the update is not a plugin decision, it is the cutover.** Core is pinned at
5.5.5 by `wp-downgrade`, and it cannot move while the `welfare` theme fatals on
PHP 8 (`functions.php:754`) — the chain is theme → PHP 8 → core → plugins. Do
**not** try CF7 in place on prod. od-stage and od-dev already run **6.1.6** on
WP 7.1 (see [`wp-backend.md`](./wp-backend.md)), so the version gap closes for
free the day prod becomes that stack, and CF7 is one of the ~4 plugins
[`prod-migration-runbook.md`](./prod-migration-runbook.md) §04 keeps.

**Where it is used — three forms, four pages.**

| Form | Title | Embedded on | Shortcode |
|---|---|---|---|
| **20138** | Твой отзыв об Общем деле | 20139 `/about/ostavit-otziv/` | `[cmsms_contact_form form_plugin="cf7" form_cf7="20138…"]` |
| **6** | Написать письмо в общее дело | 25805 `/about/написать-письмо-в-общее-дело/` | `[contact-form-7 id="6"]` |
| **30103** | Интернет волонтёр | 30102 `/get-involved/internet-volunteer/` and 32543 `/get-involved/it-volunteer/` | `[contact-form-7 id="30103"]` |

Two `content_template` rows (3382 `search`, 3455 `home3`) also carry a
`[cmsms_contact_form form_plugin="cfb" …]` — the cmsms theme's *other* form
plugin, which isn't installed. Templates aren't served, so it is dead text.

**Three of those four pages are rendered natively by us, and their form is
dead.** Only `/about/ostavit-otziv/` is in
[`legacyEmbedPages.ts`](../src/shared/config/legacyEmbedPages.ts); the other
three fall through the catch-all. Verified against stage:
`GET /wp-json/wp/v2/pages/30102` returns `content.rendered` with the full
`<div class="wpcf7" id="wpcf7-f30103-o1">` markup — and its `<form action>` is
whatever URL the body was fetched from, in that response literally
`/wp-json/wp/v2/pages/30102?…`. Nothing on our side ships CF7's script or
stylesheet (`grep -ri wpcf7 src/` finds only the generated OpenAPI types), so
those pages currently show an unstyled form that cannot submit. Either add the
three paths to `LEGACY_EMBED_PAGES` until B6 exists, or let B6 replace all four
at once.

**Prod REST is off, which likely means the отзыв form is already dead there.**
`clearfy_option.disable_json_rest_api = 'on'` (Clearfy Pro's "Disable REST
API"), and every route answers with the theme's 404 page: `/wp-json/`,
`/wp-json/contact-form-7/v1`, `/?rest_route=/`. But the live page's own inline
config is `wpcf7 = {"api":{"root":"https://obshee-delo.ru/wp-json/","namespace":"contact-form-7/v1"}}`
— CF7 5.x submits by `fetch` to exactly that root, so the browser path ends in
the 404 HTML. The page also carries reCAPTCHA v3 keys (`wpcf7_recaptcha`).
**Needs one live test submission to settle** whether anything reaches the mailbox
today; probing was kept read-only deliberately. The same flag is what B6 will
hit: a native form posting to
`POST /contact-form-7/v1/contact-forms/{id}/feedback` on prod needs that toggle
off or that one route allowlisted (§2.1's public-REST warning applies).

**Where submissions go, and why some may be lost anyway.** Forms 20138 and 6
mail `web@obshee-delo.ru, dmd_kostroma@mail.ru`; **form 30103 mails
`villain218@gmail.com`**, a personal address left from whoever built the page.
Sender on all three is `wordpress@общее-дело.рф`, and that domain's SPF still
reads `v=spf1 include:_spf.timeweb.ru ~all` — six days after the site started
sending from BeGet. Softfail into mail.ru for every notification; `obshee-delo.ru`
already includes BeGet in its SPF, so switching the sender to
`wordpress@obshee-delo.ru` is the one-field fix. Nothing stores submissions:
no Flamingo, no CF7-DB, so a mail that spam-filters away is an отзыв nobody
ever sees. Full recon:
`~/Projects/servers-agent/tasks/2026-08-20-od-root-feedback-form-recon/`.

**Next, in order.**

1. **Test the live form once** on `/about/ostavit-otziv/` and check
   `web@obshee-delo.ru` — everything below assumes we know whether prod delivers
   at all today.
2. **Fix the sender domain** (CF7 → both mail templates → `wordpress@obshee-delo.ru`)
   and **form 30103's recipient**. Both are prod-side, independent of the
   redesign, and cheap. Form 20138's disabled `_mail_2` autoreply still carries
   the theme donor's `melafi.ru` / `villain218@gmail.com` — clean it while there.
3. **Decide keep-or-drop** (runbook §12, still open): CF7 6.1.7 as the B6 forms
   backend, or drop the plugin for `app/api/*` + Yandex SmartCaptcha. If it is
   dropped, the two `[contact-form-7 …]` shortcodes must be stripped from page
   bodies in `wp/scripts/od-pages.php` first — a shortcode whose plugin is gone
   renders as its own source text.
4. **Whichever way that goes, add Flamingo or an equivalent** so submissions
   survive a mail failure — unless B6 stores them itself.

---

## «Видео события» in the film catalogue — three found, applied 2026-08-22

**A category is the whole of what puts a post on `/video/`.** The catalogue and
its four segment pages query «Фильмы» / «Мультфильмы» / «Ролики» / «Известные
люди» (`src/shared/config/filmCategories.ts`), so a news post filed under one by
hand lands between the films — which is what «ПОЖИРАТЕЛИ МОЗГА» В СЕРБСКОМ
ОПОВЕ», a report on a screening in Serbia, was doing on page 1.

`od_wp_untag_video_events()` in [`wp/scripts/od-wp.php`](../wp/scripts/od-wp.php)
takes the category off, by post slug, and is applied to **od-stage** and
**od-dev** (73220 does not exist on od-dev — the warning is correct). The
catalogue went from 85 films to 83.

**How to find the next one, since nothing enforces this:** a catalogue post
carrying a category outside {the four, «Видео события» 52, «Видео» 85, «Новости»
47} is a news post wearing a film's clothes — a region, a country, a programme.
That test picked out exactly these three of 86 and no film:

```sh
curl -s 'https://od.webtm.ru/wp-json/wp/v2/posts?categories=581,580,86,559&per_page=100&_fields=id,title,categories'
```

Add the slug to the registry, re-run the script. Not coded as a frontend filter
on purpose: the frontend would then disagree with WordPress about what a film
is, and the editor who filed it would get no signal.

**The home page had the same problem for a different reason, fixed 2026-08-22.**
Its «Фильмы» row is `fetchFilms`, and that query was `format=video` with **no
category filter at all** — so it returned the six newest video posts of any kind
and the row filled with «Видео события». Nothing to do with the three
mis-categorised posts: `73220` still appeared there after its category was
removed, and beside it sat `73141` «ДУШЕВНЫЙ СЛЕТ ДОБРОВОЛЬЦЕВ ЯКУТИИ», which
never carried a film category and never will. `format=video` is not «a film» —
there are **115** «Видео события» against 83 films, so an unscoped query is
mostly not films. `fetchFilms` now scopes to `ALL_FILM_CATEGORY_IDS`, the same
union `/video/`'s «Все» tab uses, so the two agree by construction. It was the
only unscoped `format=video` query left: the catch-all's SSG seed already
filtered, and `fetchVideoList` takes the categories from its caller.

**Then narrowed to films proper, same day.** The row reads
`HOME_FILM_CATEGORY_IDS` — **«Фильмы» + «Мультфильмы» only**, 35 posts of the
83. Out go «Ролики» (13 short promo clips) and «Известные люди» (36, the
largest of the four — so «newest» filled the row with talking heads); both read
as filler beside a full-length film. `/video/`'s «Все» is untouched and still
means all four, and the heading stays as Figma wrote it, «Наши фильмы,
мультфильмы и ролики» — it names what the CTA opens, «Все видео (83)», not the
narrower row beneath it. (It briefly followed the scope instead; reverted the
same day.) Two other things changed with it, because a carousel of six out
of 35 gives the visitor no way to tell it is a slice: it shows **12**
(`FILMS_ON_HOME` in `app/page.tsx`), and `fetchFilms` returns
`{ items, catalogueTotal }`. The count is the **catalogue's**, off a second
count-only request (`per_page=1`) over `ALL_FILM_CATEGORY_IDS`, because the CTA
reads «Все видео (83)» and leads to `/video/` — printing the row's own 35 there
would undercount what the link opens, and hard-coding 83 breaks the moment
`WP_BASE` is repointed. Rendering the whole scope was the alternative and is worse: 35
slides, 35 remote images resolved through `resolveMediaUrl`, and a Swiper
pagination strip of 33 bullets. Load-more inside the carousel would need a
client route and its own pagination, for a row whose job is to send people to
`/video/`.

**Production carried the same three, and is done — applied 2026-08-22.** They
were found off prod's own HTML, since its REST is closed and the category slugs
are only readable out of the post pages: `73220` linked `category/video/movies/`,
`52442` and `38960` linked `category/video/roliki/`. Applying it there rather
than only on the clone is what stops the cutover from inheriting them. **Only
the named task was run** — production is not migrated, and the full runner would
create the programme tags, rename its indexes and draft its empty regional
branches, none of which production has asked for:

```sh
scp wp/scripts/od-wp.php od-root:~/od-wp.php
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file ~/od-wp.php untag-video-events'
ssh od-root 'cd ~/public_html && wp --skip-plugins --skip-themes eval-file ~/od-wp.php untag-video-events apply'
```

`rehost-posters` finds nothing there — ACF is absent on production, so no film
carries a `poster_image_url` yet. **The database is right and the HTML lags:**
WP Rocket is active on the live host (above) and `--skip-plugins` keeps it from
noticing the write, so afterwards the three post pages and
`/category/video/roliki/` still listed the old categories. That it is only the
cache was confirmed by asking for the same URLs with a query string, which
Rocket does not serve from cache — those render clean. Left to expire rather
than purged, deliberately: nothing on those pages is urgent.

---

## `film:remap` rewrites ids, not URLs — 11 плакаты pointed at od-dev

**Found on new.obshee-delo.ru 2026-08-22, fixed the same day.** The film
worksheet was filled against od-dev and carried onto the prod clone with
`pnpm film:remap`, which joins the two sheets by title and rewrites the **post
ids** — they differ per environment. It does not touch the URLs *inside* the
cells, so ten films arrived on od-stage with a `poster_image_url` on
`od-dev.tmweb.ru`, and one more on `общее-дело.рф`.

`next/image` allowlists this tier's `WP_BASE` and the media CDN, not another
tier's host, and `resolveMediaUrl` only maps a URL that already starts with
`WP_BASE` — so the плакат card rendered with a **400 on its image**. The visible
symptom is a film that looks like it has no плакат while WordPress says it has
one, which is why this was mistaken for the editorial gap.

`od_wp_rehost_posters()` in [`wp/scripts/od-wp.php`](../wp/scripts/od-wp.php)
moves the origin of any `poster_image_url` whose path starts with `/wp-content/`
onto `home_url()`, carrying the path over byte for byte — these filenames are
Cyrillic and re-encoding one is how a working URL becomes a 404. It reads
`home_url()` and needs no registry, so it is safe on every tier and is a step of
the promotion rather than a repair. Applied: **od-stage 11, od-dev 1**.

**The same sheet promotes to production**, so run `od-wp.php` there after the
import — or teach `film:remap` to rehost, which would make this task find
nothing. Left undone deliberately: the task is three lines of PHP and the remap
flag would need its own tests and a target origin the CSV tool has no way to know.
