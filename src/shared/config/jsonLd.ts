import { SITE_NAME, canonicalUrl, fileUrl, siteUrl } from './site';

/**
 * schema.org JSON-LD — the structured-data half of F4.
 *
 * Pure builders returning plain objects, next to the metadata helpers they sit
 * beside; the call sites render the result in a `<script type="application/ld+json">`.
 * Deliberately **not** `next/script`: that component's strategies all defer, and
 * this markup has to be in the HTML a crawler is served.
 *
 * **Every property here is one whose data the page already holds.** Nothing in
 * this module fetches, and nothing may start to: the catch-all that renders both
 * the news and the film branch sets a module-level `revalidate`, so an uncached
 * request discovered during its render aborts with `DYNAMIC_SERVER_USAGE` — 200
 * in `next dev`, 500 in production. A builder that ever needs data must be handed
 * it by a caller that already fetched it, tagged.
 *
 * **What this is worth, honestly.** Article and VideoObject are a Google
 * investment: Yandex's own list of data it accepts from a site owner (addresses,
 * Q&A, software, рефераты, фильмы) carries neither, and its video documentation
 * says video answers «формируются автоматически, дополнительно передавать данные
 * не нужно». The one type here Yandex documents as feeding its SERP is
 * {@link breadcrumbJsonLd}. None of it is a ranking factor anywhere — it changes
 * how a result is drawn, not where it stands.
 */

/** Drop the keys with no value, so a post with no image emits no `image` key. */
const compact = (node: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(node).filter(([, value]) => value !== null && value !== undefined));

/**
 * The publisher node, and the only place a logo URL is stated.
 *
 * `src/app/icon.png` is 192×192 — the one asset in the repo that clears Google's
 * 112×112 logo floor at a stable URL. `fileUrl`, not `canonicalUrl`: the latter
 * would emit `/icon.png/`, and `trailingSlash: true` installs the inverse 308 for
 * dotted last segments. `og-default.png` is a 1200×630 social card with a
 * strapline baked in, which is not a logo.
 */
const ORG = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: siteUrl,
  logo: fileUrl('/icon.png'),
};

/**
 * The JSON, escaped for embedding in a `<script>`.
 *
 * The `<` escape is the whole reason this is a function: a WordPress title
 * carrying a literal `</script>` — and titles here reach us as HTML that has
 * been entity-decoded — would otherwise close the element and put the rest of
 * the payload into the document as markup. `<` is the same string to a JSON
 * parser and inert to an HTML one.
 */
export const jsonLdHtml = (data: Record<string, unknown>): string => JSON.stringify(data).replace(/</g, '\\u003c');

interface NewsJsonLdInput {
  /** The WP post id — the page's own address is the legacy `/<id>/`. */
  id: string;
  headline: string;
  description?: string | null;
  image?: string | null;
  /** WP's GMT timestamps, which omit the zone designator — pass them with `Z`. */
  datePublished?: string | null;
  dateModified?: string | null;
}

/**
 * `NewsArticle` for a post at `/<id>/`.
 *
 * `author` is the organisation, not a person: WP hands back a numeric
 * `post.author` and nothing here resolves it to a name, the rendered page shows
 * no byline, and publishing eighteen staff members' names in machine-readable
 * form is a bigger step than a schema line should take. Google names an
 * Organization author as valid.
 *
 * No `articleSection`: the categories arrive as unsorted ids, so the positional
 * read the page does today picks the wrong one on much of the archive (B5's
 * lesson — resolve terms by slug, or not at all).
 *
 * Returns `null` without a headline; nothing else here describes an article.
 */
export const newsJsonLd = ({
  id,
  headline,
  description,
  image,
  datePublished,
  dateModified,
}: NewsJsonLdInput): Record<string, unknown> | null => {
  if (!headline) {
    return null;
  }

  return compact({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: canonicalUrl(`/${id}/`),
    headline,
    description,
    image,
    datePublished,
    dateModified,
    author: ORG,
    publisher: ORG,
  });
};

interface FilmJsonLdInput {
  id: number;
  name: string;
  description?: string | null;
  /** The card image — never the body-image fallback, see below. */
  thumbnailUrl?: string | null;
  uploadDate?: string | null;
  /** The player the page itself embeds. Without one there is no video here. */
  embedUrl?: string | null;
}

/**
 * `VideoObject` for a film at `/<id>/`.
 *
 * **Returns `null` unless `name`, `thumbnailUrl`, `uploadDate` and `embedUrl`
 * are all present.** The first three are the properties Google marks required,
 * and a node missing one is invalid markup rather than a partial win. `embedUrl`
 * is required for a different and more important reason: without it there is no
 * video on the page to describe. The catch-all routes *every* `format=video`
 * post here — 187 of them on production against 84 films — and the «Видео
 * события» event reports among those are a photo and some text with no player at
 * all. Measured against the live install: `/73220/` and `/73141/` have a featured
 * image and a date and would have passed the first three checks, while the page
 * renders no `<iframe>` and offers nothing to watch. Marking that up as a video
 * is the «content not visible on the page» case Google's guidelines name.
 *
 * The caller must pass the **card** image. The visible thumbnail falls back to
 * the body's first picture, which on a film is as likely to be the 294×68
 * «Скачать с Яндекс.Диска» button as a frame; and `ogCardImage`'s branded
 * substitute is a wordmark, which is worse than no still at all.
 *
 * No `contentUrl`: every download this site holds is a Yandex.Disk landing page,
 * not media bytes, and pointing `contentUrl` at a page is the mistake Google's
 * own guidance names. `embedUrl` alone is the documented alternative — it costs
 * the auto-generated thumbnail and key moments, both of which need Google to
 * fetch the file. No `duration` either: the seconds exist only in Kinescope's
 * API, behind a token this repo pins to a script and never to a runtime.
 */
export const filmJsonLd = ({
  id,
  name,
  description,
  thumbnailUrl,
  uploadDate,
  embedUrl,
}: FilmJsonLdInput): Record<string, unknown> | null => {
  if (!name || !thumbnailUrl || !uploadDate || !embedUrl) {
    return null;
  }

  return compact({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl,
    uploadDate,
    url: canonicalUrl(`/${id}/`),
    embedUrl,
  });
};

/**
 * The organisation's own profiles, https and without the subscribe action the
 * footer's YouTube link carries — a `sameAs` names a profile, not a button.
 * Transcribed from `wp/scripts/od-wp.php`, which authors that footer widget, and
 * checked against production's rendered footer on 2026-09-17.
 */
const SAME_AS = [
  'https://vk.com/obsheedelorf',
  'https://ok.ru/obsheedelo',
  'https://www.youtube.com/user/proektobsheedelo',
];

/** The registered name, which is not the wordmark {@link SITE_NAME} is. */
const LEGAL_NAME = 'Общероссийская общественная организация «Общее дело»';

/**
 * `Organization` — the home page's node, and **only** the home page's.
 *
 * Google asks for it on one page rather than site-wide («You don't need to
 * include it on every page of your site»), and the root layout is the wrong
 * place for a second reason: the address, phone and registry numbers live in
 * WordPress footer widgets as positional HTML blobs, so reaching them would mean
 * parsing six `rendered` strings in every page's critical path — and getting `[]`
 * for all of them in the env-less CI build. The two values worth stating are
 * constants here, where a test can guard them; the widget is what an editor owns.
 *
 * `description` is passed in so the home page's meta description and this node
 * cannot drift apart.
 */
export const organizationJsonLd = (description: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  ...ORG,
  legalName: LEGAL_NAME,
  url: canonicalUrl('/'),
  description,
  sameAs: SAME_AS,
});

interface BreadcrumbInput {
  label: string;
  href?: string;
}

/**
 * `BreadcrumbList` — the one type on this site Yandex documents as feeding its
 * own results, which is why it is emitted from the `Breadcrumbs` component
 * itself: the markup then cannot describe a trail different from the drawn one,
 * and every page with crumbs gets it without a call site remembering to.
 *
 * `item` is omitted for a crumb with no link — Google's documented shape for the
 * final, current-page element. Every href goes through `canonicalUrl`, because a
 * slashless twin is a 301 here and a breadcrumb naming a redirect is a wasted
 * one.
 *
 * Yandex additionally drops any element under four characters and any element
 * pointing at the home page, so its view of «Главная › Новости › …» starts at
 * «Новости». That is Yandex's to do — the chain stays complete for Google, and
 * renumbering it here would make the markup disagree with the page.
 *
 * Returns `null` for fewer than two crumbs: a one-element trail is not a path.
 */
export const breadcrumbJsonLd = (items: readonly BreadcrumbInput[]): Record<string, unknown> | null => {
  if (items.length < 2) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        item: item.href ? canonicalUrl(item.href) : undefined,
      })
    ),
  };
};
