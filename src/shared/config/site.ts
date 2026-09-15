import type { Metadata } from 'next';

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
 * The organisation's name, as every page title ends with it.
 *
 * There is no `title.template` in the root layout — the native routes write the
 * suffix into their own titles — so anything building a title from data has to
 * append it here. `wpPageMetadata` is the one that does: a WP page's title is
 * whatever an editor typed, and «Материалы» alone is not what the tab or the
 * search result should read.
 */
export const SITE_NAME = 'ОБЩЕЕ ДЕЛО';

/**
 * The fallback social-card image — the wordmark on brand red, 1200×630,
 * served from `public/`. Relative on purpose: `metadataBase` absolutises it, so
 * each tier advertises its own host.
 *
 * **Every route that declares `openGraph` has to name an image**, which is why
 * this is a constant and not an `app/opengraph-image.png`. Next merges metadata
 * *shallowly*: a segment's `openGraph` replaces the parent's object wholesale,
 * so nothing is inherited from the root layout. And a file-convention image
 * outranks config metadata, so the file form would stamp this logo over a film's
 * own poster and a news post's own photo — the two cards that matter most.
 */
const OG_DEFAULT_IMAGE = '/og-default.png';

/**
 * The same card with the section named under the wordmark, for the indexes that
 * have no image of their own. A listing is not one photograph, and picking a
 * post's would advertise that post; naming the section is what tells a reader
 * where the link goes. The film catalogue's five live in `CATALOGUE_COPY`
 * alongside the rest of its per-segment copy.
 */
export const OG_NEWS_IMAGE = '/og-news.png';
export const OG_ARTICLES_IMAGE = '/og-articles.png';

/** What a card image looks like once its pixels are known. */
interface OgCardImage {
  url: string;
  width?: number;
  height?: number;
}

/** {@link OG_DEFAULT_IMAGE}, measured — the file in `public/` is 1200×630. */
const OG_DEFAULT_CARD: OgCardImage = { url: OG_DEFAULT_IMAGE, width: 1200, height: 630 };

/** The section cards are the same 1200×630 export with a word under the wordmark. */
export const ogSectionImage = (url: string): OgCardImage => ({ url, width: 1200, height: 630 });

/**
 * The defaults every route's `openGraph` object has to restate, wrapped around
 * whatever that route owns.
 *
 * The shallow-merge rule above has a second half nobody drew: a segment loses
 * `siteName` and `locale` exactly as it loses `images`. Nine hand-written call
 * sites all remembered the image — the one the comment named — and all nine
 * forgot the rest, so no card on the site carried the organisation's name and
 * the home page's own card advertised no `og:type`.
 *
 * `type` stays the caller's business: it is the union's discriminant, and the
 * wrong type is worse than no type. Hence the generic rather than a plain
 * `Metadata['openGraph']` parameter, which would widen every call site's literal
 * to the union and lose the discriminant — and hence the cast, which is what
 * that costs: TypeScript cannot prove a spread of defaults into a generic is
 * still exactly `T`. Excess-property checking survives it, because the literal is
 * still checked against `T`'s constraint at the call site.
 *
 * `countryName` is deliberately **not** here. Three of the eleven cards carried
 * it and `og:country_name` belongs to `og:business`/`og:place`, not to
 * `website`, `article` or `profile` — restating it everywhere would have spread
 * a tag that means nothing on these types.
 */
export const ogCard = <T extends NonNullable<Metadata['openGraph']>>(own: T): T =>
  ({
    siteName: SITE_NAME,
    // Open Graph wants the underscore form; `ru-RU` is silently ignored.
    locale: 'ru_RU',
    // Sized, like every other card this file hands out: a crawler that knows the
    // pixels lays the card out on the first share, before it has fetched the file.
    images: [OG_DEFAULT_CARD],
    ...own,
  }) as T;

/**
 * **200 px, not 600.** Facebook, Telegram and VK all *scale* an image between
 * 200 and 600 px into the small card — they still show the photograph. Only
 * below 200 px is there no image at all, and only that case is worth losing the
 * post's own picture over: gating at 600 sent the branded wordmark out in place
 * of a real 452×300 photo, which is a worse card than the small one it avoided.
 */
const OG_MIN_SIDE = 200;

/**
 * The image a card advertises, with `og:image:width`/`height` whenever the
 * fetcher already knew them (`media_details` rides along in the post's `_embed`
 * and costs one extra field on the attachment request).
 *
 * Two jobs, both measured on production. The numbers let a crawler lay the card
 * out on the **first** share, before it has fetched the file — which for a news
 * post is the only share that matters. And they are the detector for the posts
 * whose featured image is a 160×120 or 150×200 thumbnail: those get the branded
 * card instead of a card that is blank in Facebook and WhatsApp. An image of
 * unknown size passes through as it always did — omitting the two tags is legal,
 * guessing them is not.
 */
export const ogCardImage = (
  url: string | null | undefined,
  size?: { width?: number | null; height?: number | null } | null
): OgCardImage => {
  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  if (!url || (width && height && (width < OG_MIN_SIDE || height < OG_MIN_SIDE))) {
    return OG_DEFAULT_CARD;
  }

  return width && height ? { url, width, height } : { url };
};

/**
 * The organisation's *other* domains for the same site — the two `.рф`
 * spellings, stored everywhere in Punycode.
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
const SITE_ALIAS_ORIGINS = [
  // общее-дело.рф
  'https://xn----9sbkcac6brh7h.xn--p1ai',
  // общеедело.рф — the same organisation's second .рф spelling, without the
  // hyphen. It has always 301'd to the apex from the old install's `.htaccess`,
  // so nothing was ever served there; it is listed for the same two reasons as
  // its sibling — a body link to it is a path on this site, and `proxy.ts`
  // redirects it.
  'https://xn--90agcab0bpg7g.xn--p1ai',
];

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

/**
 * Every hostname this deployment answers on that is **not** its canonical one:
 * each alias origin above, `www.` in front of each, and `www.` in front of the
 * canonical host itself.
 *
 * Derived rather than written out, so adding a domain to
 * `SITE_ALIAS_ORIGINS` is the only edit a new alias needs.
 */
const ALIAS_HOSTS: Set<string> = (() => {
  const canonical = new URL(siteUrl).host;
  const roots = [...SITE_ALIAS_ORIGINS.map((origin) => new URL(origin).host), canonical];
  return new Set(roots.flatMap((host) => [host, `www.${host}`]).filter((host) => host !== canonical));
})();

/**
 * The canonical address for a request that arrived on an alias host, or `null`
 * when the host is already canonical — or is none of our business.
 *
 * **An allowlist, deliberately, rather than «anything that is not `siteUrl`».**
 * The container answers its own health check on `http://localhost:3000/health/`
 * and Coolify treats anything but a 200 as a failure, so a blanket rule would
 * 301 the probe and drive the application into a restart loop. `prod.…`, which
 * stays live as the fallback entrance after cutover, and any preview hostname
 * are protected by the same choice rather than by a list of exceptions.
 *
 * The port is dropped before comparing (a `Host` header carries one whenever
 * the site is not on 443) and the host is lower-cased, since neither changes
 * which site was asked for.
 */
export const resolveCanonicalRedirect = (host: string | null | undefined, path: string): string | null => {
  if (!host) {
    return null;
  }
  const bare = host.toLowerCase().split(':')[0];
  return ALIAS_HOSTS.has(bare) ? `${siteUrl}${path}` : null;
};
