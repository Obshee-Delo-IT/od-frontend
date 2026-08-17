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
 * The WooCommerce group is gone: `/shop/`, `/cart/`, `/checkout/` and
 * `/my-account/` were **deleted in WordPress on 2026-08-17**, on prod and
 * od-dev both — the shop had been switched off in copy for years and drew 16
 * views in 91 days. They now 404, which is the right answer, and needed no
 * entry here to do it.
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
 * Paths are compared **decoded**, the form `decodeSegments` produces, which is
 * why the one Cyrillic entry is written in Cyrillic rather than as the
 * percent-encoded slug WordPress stores.
 */
export const LEGACY_EMBED_PAGES = [
  '/about/',
  '/about/ostavit-otziv/',
  '/about/reviews/',
  '/about/reviews/letters/',
  '/about/reviews/middle/',
  '/about/reviews/mvd/',
  '/about/reviews/school/',
  '/about/reviews/vuz/',
  '/actual/',
  '/contacts/',
  '/get-involved/',
  '/get-involved/join/',
  '/materials/audio-roliki-social-reklama/',
  '/materials/disk/',
  '/materials/order-materials/',
  '/materials/pppuiv-constructor/',
  '/добровольчество/',
];

const LEGACY_EMBED_PAGE_SET = new Set(LEGACY_EMBED_PAGES);

export const isLegacyEmbedPage = (path: string): boolean => LEGACY_EMBED_PAGE_SET.has(path);
