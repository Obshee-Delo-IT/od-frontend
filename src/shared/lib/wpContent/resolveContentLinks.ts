import { wpBaseUrl } from '@/shared/api/httpClient';
import { internalOrigins } from '@/shared/config/site';
import { toInternalHref } from './toInternalHref';

const ANCHOR_TAG = /<a\b[^>]*>/gi;
const HREF_ATTR = /\bhref=["']([^"']*)["']/i;

/**
 * WordPress's own trees, which exist on the WordPress host and nowhere else.
 * A media link (`/wp-content/uploads/…pdf`) made root-relative would 404 on
 * this site, so those keep their origin — and one that arrives *already*
 * root-relative gets the origin put back (D6d).
 */
const WP_ONLY_PATH = /^\/wp-(content|admin|includes|json|login)/i;

const wpOrigin = wpBaseUrl.replace(/\/+$/, '');

/**
 * Rewrite the WordPress-origin links in a rendered post or page body to paths
 * this site serves (D6c).
 *
 * WordPress renders **absolute** hrefs: dynamic blocks (`wp:query`, which 86 of
 * od-dev's 170 pages carry, ~80 of them the regional `/contacts/*` template)
 * emit `href="https://od-dev.tmweb.ru/<id>/"`, and editors paste the same shape
 * by hand. Left alone every one of them navigates the visitor off the frontend
 * and onto the CMS — on production, onto the old site. `resolveContentAssets`
 * already does the equivalent for `<img>`; this is its half for `<a>`.
 *
 * The `/wp-content/…` trees move the other way (**D6d**). Those files exist on
 * the WordPress host and nowhere else, so an absolute link to one keeps its
 * origin — and a link that WordPress stored *without* one gets it back, since
 * root-relative it resolves against us and 404s. Editors write that shape
 * constantly: 12 724 such hrefs across 5 052 posts on od-dev, 286 across 37
 * pages. `resolveMediaUrl`'s `absoluteWpUrl` has done the same for `<img src>`
 * from the start; this is the `<a href>` half of it.
 *
 * Only `<a>` is touched, and only when the origin is ours (see
 * {@link toInternalHref}); external destinations and other relative hrefs pass
 * through untouched. "Ours" includes the alias domain `общее-дело.рф` — see
 * {@link internalOrigins}.
 */
export const resolveContentLinks = (html?: string | null): string => {
  if (!html) {
    return '';
  }

  return html.replace(ANCHOR_TAG, (tag) => {
    const href = tag.match(HREF_ATTR)?.[1];
    if (!href) {
      return tag;
    }

    // D6d — a path into WordPress's own trees, with no origin on it. The file
    // it names lives only on the WordPress host, so as written it 404s here.
    if (WP_ONLY_PATH.test(href)) {
      return tag.replace(HREF_ATTR, `href="${wpOrigin}${href}"`);
    }

    const internal = toInternalHref(href, internalOrigins(wpBaseUrl));
    if (internal === href || WP_ONLY_PATH.test(internal)) {
      return tag;
    }

    return tag.replace(HREF_ATTR, `href="${internal}"`);
  });
};
