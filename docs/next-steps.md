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
[`newsletter-unisender.md`](./newsletter-unisender.md). The page itself still
answers 200 and stays on the A6 fallback.

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
