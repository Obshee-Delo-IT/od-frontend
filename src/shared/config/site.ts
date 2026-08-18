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
 * The organisation's *other* domain for the same site — `общее-дело.рф`, stored
 * everywhere in Punycode.
 *
 * It is not a redirect and not a second site: the live site's own navigation
 * mixes both hosts freely (see `src/shared/legacy/__fixtures__/team.html`), and
 * editors paste whichever one their browser showed them. So a body link to
 * `https://xn----9sbkcac6brh7h.xn--p1ai/materials/ppiz-zdorov-molodez/` names a
 * page *this* site serves, and left absolute it walks the visitor onto the old
 * WordPress. Two of the three cards on `/materials/metodichki/` are exactly
 * that.
 *
 * Only the bare origin counts. The sibling subdomains are genuinely different
 * services and must stay external — `помощь.общее-дело.рф`
 * (`xn--d1aadek5agm.…`) is the donation host the header CTA points at, and
 * `xn--80a7adb.…` is the statistics site.
 */
export const SITE_ALIAS_ORIGINS = ['https://xn----9sbkcac6brh7h.xn--p1ai'];

/**
 * Every origin whose absolute URLs are really paths on this site — the
 * WordPress origin content is fetched from, our own public origin, and the
 * alias domain above. What {@link toInternalHref} strips.
 */
export const internalOrigins = (wpOrigin: string): string[] => [wpOrigin, siteUrl, ...SITE_ALIAS_ORIGINS];

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
