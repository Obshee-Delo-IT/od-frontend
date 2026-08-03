import { notFound } from 'next/navigation';
import { ImagePreviewClient } from '@/modules/News/ImagePreview';
import { parsePost, resolveContentImages } from '@/modules/News/utils';
import {
  absolutizeWpMedia,
  aspectRatioFromUrl,
  CollapsibleBody,
  extractFilmPoster,
  FilmActions,
  FilmPlayer,
  FilmPosterCard,
  RelatedFilms,
} from '@/modules/Video';
import { cachedFetchVideo, fetchVideoList, resolveMediaUrl } from '@/shared/api';
import { wpBaseUrl, wpFetch } from '@/shared/api/httpClient';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { GutenbergProvider } from '@/shared/ui/theme';
import css from './FilmPage.module.css';
import type { Metadata } from 'next';

export const dynamicParams = true;
export const revalidate = 3600;

// Children of «Видео» (85) — used to pick the sub-category the related strip
// is scoped to. Same set as the /video index filter.
const VIDEO_CATEGORY_IDS = new Set([581, 580, 86, 559]);

export async function generateStaticParams() {
  const res = await wpFetch('/wp/v2/posts?format=video&per_page=20&_fields=id');
  if (!res.ok) {
    return [];
  }
  const posts = (await res.json()) as Array<{ id?: number }>;
  return posts.filter((post) => post.id).map(({ id }) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const film = await cachedFetchVideo(id);
  if (!film) {
    return {};
  }

  return {
    title: `${film.title} — ОБЩЕЕ ДЕЛО`,
    description: film.excerpt ?? undefined,
    openGraph: {
      type: 'video.movie',
      countryName: 'Russia',
      locale: 'ru-RU',
      title: film.title,
      images: film.thumbnailUrl ? [film.thumbnailUrl] : undefined,
    },
  };
}

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const film = await cachedFetchVideo(id);
  if (!film) {
    notFound();
  }

  const relatedCategory = film.categories.find((category) => VIDEO_CATEGORY_IDS.has(category));
  const { items: relatedItems } = await fetchVideoList({ perPage: 4, category: relatedCategory });
  const related = relatedItems
    .filter((item) => item.id !== film.id)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: `/video/${item.id}`,
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
      <Breadcrumbs items={[{ label: 'Видео', href: '/video' }, { label: film.title }]} />

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

export default Page;
