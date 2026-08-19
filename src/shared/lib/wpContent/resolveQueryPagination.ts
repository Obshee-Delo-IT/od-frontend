const ANCHOR_TAG = /<a\b[^>]*>/gi;
const HREF_ATTR = /\bhref=["']([^"']*)["']/i;

/** The two classes core puts on a pagination link, and nothing else on a page carries. */
const PAGINATION_LINK = /\bclass=["'][^"']*\b(?:page-numbers|wp-block-query-pagination-(?:next|previous))\b/i;

/**
 * The page number inside a core pagination href, whatever the query block's id.
 * A link without one is core's «page 1» link.
 */
const PAGE_PARAM = /\bquery-\d+-page=(\d+)/;

/** `/about/smi/` + 2 → `/about/smi/page/2/`; page 1 is the page's own address. */
export const paginatedPath = (path: string, page: number): string => {
  const base = path.endsWith('/') ? path : `${path}/`;
  return page > 1 ? `${base}page/${page}/` : base;
};

/**
 * Point a `core/query` block's pagination at this site (D3).
 *
 * WordPress builds those hrefs from `$_SERVER['REQUEST_URI']`, and the request
 * it renders for is **ours** — a REST call. So the links it emits address the
 * API: `…/wp-json/wp/v2/pages?slug=smi&_fields=…&query-95-page=2`, which no
 * visitor can follow. Every paginated page on the site has been stuck on page 1
 * since D6b because of it — `/about/smi/` (210 posts) and
 * `/about/reviews/letters/` (125) most visibly.
 *
 * The destination is a **path**, `/about/smi/page/2/`, not a `?page=2` the rest
 * of the site uses for its listings. Not a style choice: `/news/` and
 * `/materials/articles/` are routes of their own and can read `searchParams`,
 * while these pages are served by the `[...slug]` catch-all, which also serves
 * `/<id>` — 46 % of all site entries. One `searchParams` read there makes the
 * whole route dynamic and costs every post its ISR entry. A path segment costs
 * nothing, is what WordPress itself paginates with, and stays cacheable.
 *
 * Only the href changes; the label, the chevron and the `current` span are
 * core's, and `.od-post-cards` in `gutenberg.css` styles them.
 */
export const resolveQueryPagination = (html: string, path: string): string =>
  html.replace(ANCHOR_TAG, (tag) => {
    if (!PAGINATION_LINK.test(tag)) {
      return tag;
    }
    const href = tag.match(HREF_ATTR)?.[1];
    if (href === undefined) {
      return tag;
    }
    return tag.replace(HREF_ATTR, `href="${paginatedPath(path, Number(href.match(PAGE_PARAM)?.[1] ?? 1))}"`);
  });
