import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchVideoList } from '@/shared/api';
import {
  ALL_FILM_CATEGORY_IDS,
  catalogueHref,
  FILM_CATEGORIES,
  type FilmCategorySegment,
} from '@/shared/config/filmCategories';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Pagination } from '@/shared/ui/components/Pagination';
import { VideoCard } from '../VideoCard';
import { VideoFilter, type VideoFilterOption } from '../VideoFilter';
import css from './VideoCatalogue.module.css';
import type { Metadata } from 'next';

const PER_PAGE = 10;

/** «Все» — the union of the four sub-categories — as a filter/copy key. */
const ALL = 'all';

type CatalogueKey = FilmCategorySegment | typeof ALL;

interface CatalogueCopy {
  /** Filter tab and breadcrumb wording. */
  label: string;
  /** The red H1. */
  heading: string;
  title: string;
  description: string;
}

/**
 * Per-page copy, in filter order. Every catalogue page is separately
 * indexable, so each gets its own title and description — two pages sharing a
 * title is the duplicate search engines resolve by dropping one of them.
 */
const CATALOGUE_COPY: Record<CatalogueKey, CatalogueCopy> = {
  all: {
    label: 'Все',
    heading: 'Фильмы Общего дела',
    title: 'Видеоматериалы — ОБЩЕЕ ДЕЛО',
    description: 'Фильмы, мультфильмы и видеоролики общероссийской общественной организации «Общее дело»',
  },
  filmy: {
    label: 'Фильмы',
    heading: 'Фильмы',
    title: 'Фильмы — ОБЩЕЕ ДЕЛО',
    description: 'Фильмы общероссийской общественной организации «Общее дело»',
  },
  multy: {
    label: 'Мультфильмы',
    heading: 'Мультфильмы',
    title: 'Мультфильмы — ОБЩЕЕ ДЕЛО',
    description: 'Мультфильмы общероссийской общественной организации «Общее дело»',
  },
  roliki: {
    label: 'Ролики',
    heading: 'Ролики',
    title: 'Видеоролики — ОБЩЕЕ ДЕЛО',
    description: 'Видеоролики общероссийской общественной организации «Общее дело»',
  },
  'famous-people': {
    label: 'Известные люди',
    heading: 'Известные люди',
    title: 'Известные люди — ОБЩЕЕ ДЕЛО',
    description: 'Видео с участием известных людей — общероссийская общественная организация «Общее дело»',
  },
};

// Declaration order above is the order of the tabs strip.
const CATALOGUE_KEYS = Object.keys(CATALOGUE_COPY) as CatalogueKey[];

const copyFor = (segment: FilmCategorySegment | null): CatalogueCopy => CATALOGUE_COPY[segment ?? ALL];

/** `?page=` as a page number; anything that isn't a page past the first is 1. */
export const cataloguePage = (value: string | string[] | undefined): number => {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(raw) && raw > 1 ? Math.floor(raw) : 1;
};

export const catalogueMetadata = (segment: FilmCategorySegment | null, page = 1): Metadata => {
  const copy = copyFor(segment);
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      // Paginated views self-canonicalise: page 2 holds different films, and
      // pointing it at page 1 would leave everything past the tenth film with
      // no indexable address at all.
      canonical: canonicalUrl(catalogueHref({ segment, page })),
    },
  };
};

export interface VideoCatalogueProps {
  /** `null` renders «Все» — the union of the four sub-categories. */
  segment: FilmCategorySegment | null;
  page: number;
}

/**
 * The film catalogue: `/video/` and each `/video/<segment>/` render this same
 * body, differing only in which category they scope to. It lives in the module
 * rather than in `app/` because two routes share it — the same split as
 * {@link FilmPage}, which `/[...slug]` dispatches to.
 */
export const VideoCatalogue = async ({ segment, page }: VideoCatalogueProps) => {
  const { items, totalPages } = await fetchVideoList({
    page,
    perPage: PER_PAGE,
    category: segment ? FILM_CATEGORIES[segment] : ALL_FILM_CATEGORY_IDS,
  });

  const copy = copyFor(segment);
  const catalogueRoot = catalogueHref({ segment: null });
  const breadcrumbItems = segment
    ? [{ label: 'Главная', href: '/' }, { label: 'Видео', href: catalogueRoot }, { label: copy.label }]
    : [{ label: 'Главная', href: '/' }, { label: 'Видео' }];

  const filterOptions: VideoFilterOption[] = CATALOGUE_KEYS.map((key) => ({
    label: CATALOGUE_COPY[key].label,
    value: key,
    href: catalogueHref({ segment: key === ALL ? null : key }),
  }));

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title={copy.heading} breadcrumbs={breadcrumbItems} />

      <VideoFilter options={filterOptions} active={segment ?? ALL} />

      {items.length > 0 ? (
        <div className={css.list}>
          {items.map((film) => (
            <VideoCard
              key={film.id}
              title={film.title}
              href={`/${film.id}/`}
              imageSrc={film.thumbnailUrl}
              imageAlt={film.title}
              description={film.excerpt}
              trailerUrl={film.trailerUrl}
              downloads={film.downloads}
              share={film.share}
            />
          ))}
        </div>
      ) : (
        <p className={css.empty}>Фильмов не найдено.</p>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(target) => catalogueHref({ segment, page: target })}
      />

      <NewsletterSignup variant="card" />
    </Box>
  );
};
