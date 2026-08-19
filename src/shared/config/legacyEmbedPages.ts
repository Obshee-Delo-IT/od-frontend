/**
 * The paths that stay on the **A6 legacy iframe** instead of being rendered
 * from WordPress by us (D6).
 *
 * The default is the other way round: any path the catch-all reaches is looked
 * up in WordPress and, if a published page answers for it, rendered natively —
 * same URL, same content, no route and no component per page, editors still
 * working in WP. That covers ~150 pages with nothing to configure. This list is
 * the exception, and the fallback is still automatic underneath it: a path WP
 * has no page for goes to the embed too.
 *
 * **What lands here.** Content that only means something under the old theme —
 * which is exactly what the iframe supplies. Measured 2026-08-15 over all 174
 * published pages: `cmsms-gutenberg-upgrade` has run on od-dev (see
 * `CLAUDE.md`), so the only surviving shortcodes were WooCommerce's four, and 23
 * pages still carry bare `cmsms_*` class names.
 *
 * That shortcode count was low, and the reason is worth knowing: it was taken
 * from `content.rendered`, where WordPress has already **expanded** every
 * shortcode whose plugin is still active — so a surviving `[cmsms_*]` reads as
 * ordinary markup rather than as a shortcode. Re-measured 2026-08-18 against raw
 * `post_content`: **11 published pages** still hold one (`[cmsms_sidebar]` on
 * seven, plus `[cmsms_contact_form]`, `[cmsms_selected_products]`,
 * `[cmsms_audios]`), and all 11 are covered — nine by the list below, `/news/`
 * by its native route, and two by having the thing that put them here taken
 * out: D6l turned `/materials/audio-roliki-social-reklama/`'s four
 * `[cmsms_audio]` file paths into `core/audio` blocks, and D6m dropped
 * `/materials/disk/`'s «Добавить в корзину» links, which were the last of the
 * WooCommerce shop and pointed at pages deleted in WordPress on 2026-08-17. Four published *posts* hold one too
 * (`[cmsms_slider]`, `[cmsms_audios]`, `[cmsms_table]`, `[cmsms_tabs]`, ids
 * 41045 / 56178 / 62556 / 64555), and those are cosmetic: each expands to under
 * 450 bytes, so the body around them renders. The reason to care at all is the
 * cutover — the frozen copy keeps the plugin, this install eventually will not,
 * and a shortcode with no plugin renders as its own source text.
 *
 * The WooCommerce group is gone: `/shop/`, `/cart/`, `/checkout/` and
 * `/my-account/` were **deleted in WordPress on 2026-08-17**, on prod and
 * od-dev both — the shop had been switched off in copy for years and drew 16
 * views in 91 days. They now 404, which is the right answer, and needed no
 * entry here to do it. `/materials/order-materials/` went the same way — the
 * page was what was left of that shop, a «Корзина заказов» button into `/cart/`
 * over its own «заказ материалов не осуществляется» (see `docs/next-steps.md`
 * for the mail-delivery reason the nav item went first).
 *
 * Three of the 23 are deliberately **not** here — `/healthy-russia/`,
 * `/healthy-kids/` and `/healthy-youth/`, the programme pages. Their `cmsms_*`
 * residue is a heading class on three closing links, and they were checked in a
 * browser at 1440 and 375 when the native rendering shipped: banner, goal/tasks
 * column and film-poster grid all come out right. Three more of the 23 are
 * absent because they can't reach this route at all — `/`, `/news/` and
 * `/video/famous-people/` are native routes, which App Router gives precedence
 * over `[...slug]`.
 *
 * The `/about/reviews/` group — the page and its five category children — came
 * off on 2026-08-19 (D6p). What put them here was the `[cmsms_sidebar]` beside
 * the card grid, and `od_pages_post_cards()` drops it: the query block over the
 * category is the whole page, and `gutenberg.css` draws its cards. That leaves
 * `/about/ostavit-otziv/` as the section's one remaining entry, and it is here
 * for a different reason — a Contact Form 7 form, which nothing on this side
 * renders.
 *
 * Paths are compared **decoded**, the form `decodeSegments` produces, which is
 * why the one Cyrillic entry is written in Cyrillic rather than as the
 * percent-encoded slug WordPress stores.
 */
export const LEGACY_EMBED_PAGES = [
  '/about/',
  '/about/ostavit-otziv/',
  '/actual/',
  '/contacts/',
  '/get-involved/',
  '/get-involved/join/',
  '/materials/pppuiv-constructor/',
  '/добровольчество/',
];

const LEGACY_EMBED_PAGE_SET = new Set(LEGACY_EMBED_PAGES);

export const isLegacyEmbedPage = (path: string): boolean => LEGACY_EMBED_PAGE_SET.has(path);
