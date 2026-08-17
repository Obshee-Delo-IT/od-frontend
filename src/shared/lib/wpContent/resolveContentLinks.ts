import { wpBaseUrl } from '@/shared/api/httpClient';
import { siteUrl } from '@/shared/config/site';
import { toInternalHref } from './toInternalHref';

const ANCHOR_TAG = /<a\b[^>]*>/gi;
const HREF_ATTR = /\bhref=["']([^"']*)["']/i;

/**
 * WordPress's own trees, which exist on the WordPress host and nowhere else.
 * A media link (`/wp-content/uploads/…pdf`) made root-relative would 404 on
 * this site, so those keep their origin.
 */
const WP_ONLY_PATH = /^\/wp-(content|admin|includes|json|login)/i;

/**
 * Rewrite the WordPress-origin links in a rendered post or page body to paths
 * this site serves (D6c).
 *
 * WordPress renders **absolute** hrefs: dynamic blocks (`wp:query`, which 86 of
 * od-dev's 170 pages carry, ~80 of them the regional `/contacts/*` template)
 * emit `href="https://od-dev.tmweb.ru/<id>/"`, and editors paste the same shape
 * by hand. Left alone every one of them navigates the visitor off the frontend
 * and onto the CMS — on production, onto the old site. `resolveContentImages`
 * already does the equivalent for `<img>`; this is its half for `<a>`.
 *
 * Only `<a>` is touched, and only when the origin is ours (see
 * {@link toInternalHref}); external destinations and relative hrefs pass
 * through untouched, as do links into WordPress's own file trees.
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

    const internal = toInternalHref(href, [wpBaseUrl, siteUrl]);
    if (internal === href || WP_ONLY_PATH.test(internal)) {
      return tag;
    }

    return tag.replace(HREF_ATTR, `href="${internal}"`);
  });
};
