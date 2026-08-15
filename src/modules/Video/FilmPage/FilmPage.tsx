import { notFound } from 'next/navigation';
import { cachedFetchVideo, fetchVideoList, resolveMediaUrl } from '@/shared/api';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { ALL_FILM_CATEGORY_IDS, catalogueHref } from '@/shared/config/filmCategories';
import { canonicalUrl } from '@/shared/config/site';
import { parsePost, resolveContentImages } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { GutenbergProvider } from '@/shared/ui/theme';
import { CollapsibleBody } from '../CollapsibleBody';
import { FilmActions } from '../FilmActions';
import { FilmPlayer } from '../FilmPlayer';
import { FilmPosterCard } from '../FilmPosterCard';
import { RelatedFilms } from '../RelatedFilms';
import { absolutizeWpMedia, aspectRatioFromUrl, extractFilmPoster } from '../utils';
import css from './FilmPage.module.css';
import type { Metadata } from 'next';

export interface FilmPageProps {
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
    openGraph: {
      type: 'video.movie',
      url,
      countryName: 'Russia',
      // Open Graph wants the underscore form; `ru-RU` is silently ignored.
      locale: 'ru_RU',
      title: film.title,
      description: film.excerpt ?? undefined,
      images: film.thumbnailUrl ? [film.thumbnailUrl] : undefined,
    },
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
  const relatedCategory = film.categories.find((category) => ALL_FILM_CATEGORY_IDS.includes(category));
  const { items: relatedItems } = await fetchVideoList({
    perPage: 4,
    category: relatedCategory ?? ALL_FILM_CATEGORY_IDS,
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
  const parsed = parsePost(await resolveContentImages(extracted.html));
  const rawPosterImageUrl = film.posterImageUrl ?? extracted.posterImageUrl;
  const posterImageUrl = rawPosterImageUrl ? await resolveMediaUrl(rawPosterImageUrl) : null;
  const posterAspectRatio = film.posterImageUrl ? aspectRatioFromUrl(film.posterImageUrl) : extracted.posterAspectRatio;
  const posterDownloadUrl = film.posterDownloadUrl ?? extracted.posterDownloadUrl;
  const hasPosterCard = Boolean(posterImageUrl || posterDownloadUrl);

  return (
    <Box display="flex" flexDirection="column" gap={{ mobile: 32, smallDesktop: 40, desktop: 40 }} py={48}>
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
