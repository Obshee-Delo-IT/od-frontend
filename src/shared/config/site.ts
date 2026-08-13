/**
 * The site's public origin — what canonical tags, OG URLs and the sitemap must
 * advertise (A8 / F4).
 *
 * Not a secret and not the WordPress origin: `WP_BASE` is where content is
 * fetched from, this is where the site is *served*. They differ in every
 * environment, and getting them confused would publish `od-dev.tmweb.ru` URLs
 * into a production sitemap.
 *
 * Defaults to production so a misconfigured deploy advertises the right host
 * rather than `localhost`. Override per environment with `SITE_URL`.
 */
const DEFAULT_SITE_URL = 'https://obshee-delo.ru';

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');

/**
 * Absolute URL for a path, in the site's canonical form.
 *
 * **Always trailing-slashed** (bar the query), because `trailingSlash: true`
 * makes the slashed form the only one that answers 200 — advertising the
 * slashless twin in a canonical tag or sitemap would point search engines at a
 * redirect. See A8 in the implementation plan.
 */
export const canonicalUrl = (path = '/'): string => {
  const [pathname, query] = path.split('?');
  const normalised = `/${pathname.split('/').filter(Boolean).join('/')}`;
  const slashed = normalised === '/' ? '/' : `${normalised}/`;
  return `${siteUrl}${slashed}${query ? `?${query}` : ''}`;
};

/**
 * Absolute URL for a served *file* — `/sitemap.xml`, `/robots.txt`.
 *
 * The one place {@link canonicalUrl} must not be used: it would produce
 * `…/sitemap.xml/`, and `trailingSlash: true` installs the inverse redirect for
 * dotted last segments (`/:file(…\.\w+)/ → /:file`, permanent), so the slashed
 * form is the one that 308s. Advertising a redirecting sitemap in robots.txt is
 * exactly the hop this work exists to remove.
 */
export const fileUrl = (path: string): string => `${siteUrl}/${path.replace(/^\/+/, '')}`;
