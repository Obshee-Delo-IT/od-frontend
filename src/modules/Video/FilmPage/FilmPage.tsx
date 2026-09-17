import { notFound } from 'next/navigation';
import { cachedFetchVideo, fetchVideoList, resolveMediaUrl } from '@/shared/api';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { allFilmCategoryIds } from '@/shared/api/termIds';
import { catalogueHref } from '@/shared/config/filmCategories';
import { jsonLdHtml, filmJsonLd } from '@/shared/config/jsonLd';
import { canonicalUrl, ogCard, ogCardImage } from '@/shared/config/site';
import { parsePost, resolveContentHtml } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { GutenbergProvider } from '@/shared/ui/theme';
import { CollapsibleBody } from '../CollapsibleBody';
import { FilmActions } from '../FilmActions';
import { FilmPlayer, kinescopeEmbedUrl } from '../FilmPlayer';
import { FilmPosterCard } from '../FilmPosterCard';
import { RelatedFilms } from '../RelatedFilms';
import { absolutizeWpMedia, aspectRatioFromUrl, extractFilmPoster } from '../utils';
import css from './FilmPage.module.css';
import type { Metadata } from 'next';

interface FilmPageProps {
  /** WP post id, from the legacy `/<id>` URL. */
  id: string;
}

export const filmMetadata = (film: NonNullable<Awaited<ReturnType<typeof cachedFetchVideo>>>): Metadata => {
  // The canonical is the legacy `/<id>/` this page is served at — the address
  // the sitemap publishes and `/video/<id>` redirects to.
  const url = canonicalUrl(`/${film.id}/`);

  return {
    title: `${film.title} — ОБЩЕЕ ДЕЛО`,
    description: film.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: ogCard({
      type: 'video.movie',
      url,
      title: film.title,
      description: film.excerpt ?? undefined,
      // `cardImageUrl`, not the visible thumbnail: the body-image fallback is
      // whatever the post opens with, and on a film that is often a download
      // button. The featured image's pixels come free with the `_embed`, so the
      // card states them when it is the one that won.
      images: [ogCardImage(film.cardImageUrl, film.thumbnailSize)],
    }),
  };
};

/**
 * The film player page. Lives in the module rather than in `app/` because the
 * canonical URL is the legacy `/<id>` (see A8 in the implementation plan), and
 * that route is a catch-all dispatcher shared with news — it can't own the
 * film-specific fetching and layout.
 */
export const FilmPage = async ({ id }: FilmPageProps) => {
  const film = await cachedFetchVideo(id);
  if (!film) {
    notFound();
  }

  // Same sub-category when the film has one, otherwise the catalogue at large.
  const catalogueIds = await allFilmCategoryIds();
  const relatedCategory = film.categories.find((category) => catalogueIds.includes(category));
  const { items: relatedItems } = await fetchVideoList({
    perPage: 4,
    category: relatedCategory ? [relatedCategory] : catalogueIds,
  });
  const related = relatedItems
    .filter((item) => item.id !== film.id)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: `/${item.id}/`,
      thumbnailUrl: item.thumbnailUrl,
      share: item.share,
    }));

  // The legacy body carries the poster/cover figure and download links; the
  // poster card + pills render them structured, so lift them before parsing
  // (extraction always runs — it also keeps the legacy blocks out of the
  // body). The ACF fields are the canonical source; body-parsed values only
  // fill in what data entry hasn't covered yet (deduped by URL, ACF label wins).
  const knownDownloadUrls = new Set(film.downloads.map((download) => download.url));
  const extracted = extractFilmPoster(absolutizeWpMedia(film.contentHtml, wpBaseUrl));
  const downloads = [
    ...film.downloads,
    ...extracted.downloads.filter((download) => !knownDownloadUrls.has(download.url)),
  ];
  /* `false`, unlike the news article: this page's above-the-fold image is the
     player's own poster, which `FilmPlayer` already renders with `priority`.
     Promoting the body's first image too preloaded the *same* photo a second
     time — the raw CDN full-size beside a `/_next/image` variant of it
     (DATA-09). */
  const parsed = parsePost(await resolveContentHtml(extracted.html, false));
  const rawPosterImageUrl = film.posterImageUrl ?? extracted.posterImageUrl;
  const posterImageUrl = rawPosterImageUrl ? await resolveMediaUrl(rawPosterImageUrl) : null;
  const posterAspectRatio = film.posterImageUrl ? aspectRatioFromUrl(film.posterImageUrl) : extracted.posterAspectRatio;
  const posterDownloadUrl = film.posterDownloadUrl ?? extracted.posterDownloadUrl;
  const hasPosterCard = Boolean(posterImageUrl || posterDownloadUrl);

  /* `cardImageUrl`, not the visible thumbnail, for the reason the card states
     above — and no node at all when there is no still or no date. That guard is
     what keeps this off the «Видео события» reports: the catch-all sends every
     `format=video` post here, which on production is 187 of them against 84
     films, and a report has no player and often no image. */
  const schema = filmJsonLd({
    id: film.id,
    name: film.title,
    description: film.excerpt,
    thumbnailUrl: film.cardImageUrl,
    uploadDate: film.dateGmt ? `${film.dateGmt}Z` : null,
    embedUrl: film.kinescopeId ? kinescopeEmbedUrl(film.kinescopeId) : null,
  });

  return (
    <Box display="flex" flexDirection="column" gap={{ mobile: 32, smallDesktop: 40, desktop: 40 }} pt={20} pb={48}>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(schema) }} />}
      {/* Slash-terminated: `trailingSlash: true` makes the slashless twin a redirect. */}
      <Breadcrumbs items={[{ label: 'Видео', href: catalogueHref({ segment: null }) }, { label: film.title }]} />

      <div className={css.hero}>
        <FilmPlayer
          title={film.title}
          kinescopeId={film.kinescopeId}
          watchUrl={film.watchUrl}
          posterUrl={film.thumbnailUrl}
        />
        <FilmActions trailerUrl={film.trailerUrl} downloads={downloads} share={film.share} />
      </div>

      <div className={css.content}>
        <div className={css.main}>
          <h1 className={css.title}>{film.title}</h1>
          {parsed.body ? (
            <CollapsibleBody className={css.body}>
              <ImagePreviewClient>
                <GutenbergProvider as="section">
                  {parsed.header}
                  {parsed.body}
                </GutenbergProvider>
              </ImagePreviewClient>
            </CollapsibleBody>
          ) : null}
        </div>

        {hasPosterCard ? (
          <FilmPosterCard
            title={film.title}
            imageUrl={posterImageUrl}
            imageAspectRatio={posterAspectRatio}
            downloadUrl={posterDownloadUrl}
          />
        ) : null}
      </div>

      <RelatedFilms films={related} />
    </Box>
  );
};
