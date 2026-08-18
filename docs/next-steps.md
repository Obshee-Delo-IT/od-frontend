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
the WP Rocket cache-directory observation (`wp-rocket.off-2026-08-14` exists on
Timeweb; BeGet was not inspected), and the `upload_url_path` / media-offload
answer. Re-run each on `od-root` before the migration depends on it. The two
places already re-verified on BeGet: `clearfy_option.disable_json_rest_api` is
still `'on'`, and `wp --skip-plugins --skip-themes` is still the invocation that
works.

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

## `WpPage` breadcrumbs start at «Главная», the mocks start at the parent

**Found 2026-08-17**, redesigning `/materials/metodichki/`. Figma `handbooks`
draws «Материалы › Методические пособия»; `WpPage` renders «Главная ›
Методические пособия», because it builds the trail from two literals — the root
and the page's own title. Every one of the ~150 native WP pages is the same, and
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

## `.wp-block-group h2` lowercases «Россия»

**Found 2026-08-17.** `gutenberg.css` has
`.wp-block-group h2 { text-transform: lowercase }` with a `::first-letter`
override, which sentence-cases the all-caps headings WordPress content is full
of. It also lowercases every *proper noun* after the first word:
`/materials/metodichki/` rendered «Здоровая россия — общее дело» until those
three headings were removed for the mock, and any page that keeps a heading with
a place or a name in it will do the same.

**The real fix is content, not CSS** — sentence-case the headings in WordPress
(an `od-pages.php` transform can do a page at a time) and delete the rule. Until
then, check every heading a redesigned page keeps.

**Scale unmeasured.** Worth counting the headings that hold a capitalised word
past the first before deciding whether this is a sweep or a handful.

---

## Profile 46651's slug names a different person

**Found 2026-08-17.** The record titled «Андрей Алексеевич Рязанов» has
`post_name` `гордикова-екатерина` (percent-encoded) and `_wp_old_slug`
`екатерина-гордикова`: it was Екатерина Гордикова and was retitled in place
without re-slugging. `/materials/metodichki/` now links it, so the wrong name is
visible in the href.

**Not fixable from here, and that is the interesting part.** After cutover
`/profile/*` is still served by the A6 iframe against the frozen copy, which is
keyed on the **live** path — so re-slugging od-dev's record would make the page
404 in the iframe. The slug can only change once `/profile/[slug]` is a native
route (D3, Tier 2), and even then it wants a `_wp_old_slug` redirect.

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

## Linkify the contacts inside `profile` bodies

**Measured 2026-08-18.** Of 139 published records, **82 hold a phone number typed
as plain text** outside any anchor and 5 an e-mail, against 24 that link the phone
with `tel:`. `parseProfileBody` reads anchors only — by design, see
`src/shared/api/profileCard.ts` — so those records render a card with no phone
row. 30 records show no contact at all; 109 show at least one.

**What to do:** one pure transform in the `wp/scripts/od-pages.php` mould over the
`profile` post type — plain-text phones, e-mails and bare `vk.com`/`t.me` URLs
into anchors, idempotent by detection (skip anything already inside an `<a>`).
Formats seen in the data: `89185700050`, `тел.: +79062755758`, `+79030913733`,
`тел. 8(987)839-53-53`, `e-mail: x@y.ru`. Expected effect: card contact coverage
109/139 → ~137/139, **with no frontend change**. This is the alternative to
backfilling ACF fields — see [`wp-backend.md` §3.1](./wp-backend.md), "Fields for
`profile`: a pattern, not ACF".

Note `od-pages.php` currently resolves a target by path or title, one record per
entry; a sweep over a whole post type needs a third resolver kind (~10 lines).

## `/contacts/samarskaya/` lists no coordinators, and the term exists

**Found 2026-08-18.** Page 21557's `core/query` block still carries the old
`taxQuery: {"post_tag": [-1]}` placeholder — the "match nothing" fallback from
before [`wp-page-passthrough.md` §5a](./wp-page-passthrough.md) was fixed. It is
**the one page of the 75 the re-migration could not touch**: its
`nvp_content_copy` backup is empty, so `wp cmsms migrate` has no original
shortcode to convert. Meanwhile the right term is there — `activity-samara`
(`pl-categs` 532) with **8 profiles**.

**What to do:** rewrite that one block's `taxQuery` to `{"pl-categs":[532]}`.
Term ids are per-environment, so this belongs in `od-pages.php` resolving the term
by slug at run time, not as a literal.

## Four regional contact pages point at the wrong region, and always did

**Found 2026-08-18.** `/contacts/murmanskaya/`, `smolenskaya/`, `mordoviya/` and
`astrakhanskaya/` each carry `taxQuery: {"pl-categs":[-1]}`, correctly: their
original shortcode read `categories="архангельская-область"` — a copy-paste on the
legacy site, which rendered them empty too. And `pl-categs` has **no term at all**
for Murmansk, Smolensk, Mordovia or Astrakhan, so there is nothing to repoint them
at. 20 of the 72 terms have zero profiles.

**What to do:** a content question for the coordinators, not a code fix — either
those four regions have contacts to tag or the pages should stop implying they do.

## Icons carry no `aria-hidden`, app-wide

**Found 2026-08-18.** The `@svgr/webpack` wrappers in
`src/shared/ui/components/Icons/index.tsx` pass no `aria-hidden`, so every
decorative glyph is an anonymous `img` node in the accessibility tree. `PersonCard`
now sets it at the call site, which is the local fix; the general one is
`svgProps: { 'aria-hidden': 'true' }` in the loader config, one line — but it
would also hide the icons that *are* the accessible name of their control, so each
icon-only button needs an `aria-label` checked first. Worth doing as its own pass
over the ~25 icons.

## Two footer/heading semantics gaps outside D8

**Found 2026-08-18** while auditing `/materials/metodichki/` in a production build:

- The footer's social row is a `<h2 class="wp-block-heading">` **with no text**,
  wrapping three icon links — an empty heading in the a11y tree. Global, comes
  from the WordPress footer widget.
- `/contacts/<region>/` pages go `h1` → **`h3`** (the coordinator teaser's title)
  → `h2` «События». The coordinator query block has no section heading of its own.
  A skipped level on ~75 pages; fixable with one heading block per page, or by
  dropping the teaser title's level.
