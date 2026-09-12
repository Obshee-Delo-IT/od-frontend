import { notFound } from 'next/navigation';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchVideoList } from '@/shared/api';
import {
  ALL_FILM_CATEGORY_IDS,
  catalogueHref,
  FILM_CATEGORIES,
  type FilmCategorySegment,
} from '@/shared/config/filmCategories';
import { filmTopicIds, filmTopicLabels, type FilmTopicKey, resolveFilmTopics } from '@/shared/config/filmTopics';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Pagination } from '@/shared/ui/components/Pagination';
import { TopicFilter } from '../TopicFilter';
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
  /** The social card, with this section named on it (`public/og-*.png`). */
  card: string;
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
    card: '/og-video.png',
  },
  filmy: {
    label: 'Фильмы',
    heading: 'Фильмы',
    title: 'Фильмы — ОБЩЕЕ ДЕЛО',
    description: 'Фильмы общероссийской общественной организации «Общее дело»',
    card: '/og-filmy.png',
  },
  multy: {
    label: 'Мультфильмы',
    heading: 'Мультфильмы',
    title: 'Мультфильмы — ОБЩЕЕ ДЕЛО',
    description: 'Мультфильмы общероссийской общественной организации «Общее дело»',
    card: '/og-multy.png',
  },
  roliki: {
    label: 'Ролики',
    heading: 'Ролики',
    title: 'Видеоролики — ОБЩЕЕ ДЕЛО',
    description: 'Видеоролики общероссийской общественной организации «Общее дело»',
    card: '/og-roliki.png',
  },
  short: {
    label: 'Короткометражные',
    heading: 'Короткометражные',
    title: 'Короткометражные фильмы — ОБЩЕЕ ДЕЛО',
    description: 'Короткометражные фильмы общероссийской общественной организации «Общее дело»',
    // No card of its own — the section is new and the artwork is one file the
    // designer has yet to draw; `/og-video.png` names the catalogue, which is
    // true of this page too.
    card: '/og-video.png',
  },
  'famous-people': {
    label: 'Известные люди',
    heading: 'Известные люди',
    title: 'Известные люди — ОБЩЕЕ ДЕЛО',
    description: 'Видео с участием известных людей — общероссийская общественная организация «Общее дело»',
    card: '/og-famous-people.png',
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

/** `?topic=` as a normalised topic list — see {@link resolveFilmTopics}. */
export const catalogueTopics = (value: string | string[] | undefined): FilmTopicKey[] => resolveFilmTopics(value);

/** Every catalogue title ends with it, and a page number goes *before* it. */
const TITLE_SUFFIX = ' — ОБЩЕЕ ДЕЛО';

export const catalogueMetadata = (
  segment: FilmCategorySegment | null,
  page = 1,
  topics: FilmTopicKey[] = []
): Metadata => {
  const copy = copyFor(segment);
  // Numbered the way `/news/` numbers its own: all four `/video/filmy/?page=N`
  // URLs shared one `<title>`, which is the collision search engines dedupe by
  // dropping pages (SEO-10).
  const base = topics.length > 0 ? `${copy.title.replace(TITLE_SUFFIX, '')}: ${filmTopicLabels(topics)}` : copy.title;
  const stem = base.replace(TITLE_SUFFIX, '');
  const title = page > 1 ? `${stem}, страница ${page}${TITLE_SUFFIX}` : `${stem}${TITLE_SUFFIX}`;
  // Paginated views self-canonicalise: page 2 holds different films, and
  // pointing it at page 1 would leave everything past the tenth film with no
  // indexable address at all. A topic selection self-canonicalises for the same
  // reason and is kept out of the index instead — see below.
  const url = canonicalUrl(catalogueHref({ segment, page, topics }));
  return {
    title,
    description: copy.description,
    alternates: { canonical: url },
    /* Ten topics are 1 023 selections, each of them a real page over a real
       subset of films — so pointing them at the unfiltered catalogue would be a
       lie, and leaving them indexable would hand a crawler a thousand
       near-duplicates of a 84-film catalogue. `noindex, follow`: the films
       themselves are reached and indexed through the five category pages, which
       stay indexable. The five unfiltered pages are unaffected. */
    ...(topics.length > 0 ? { robots: { index: false, follow: true } } : {}),
    /* Five URLs come through here, and none of them declared `openGraph` — so
       all five inherited the root layout's, and a `/video/filmy/` link shared
       into Telegram unfurled as «ОБЩЕЕ ДЕЛО» with the home page's description,
       indistinguishable from `/video/multy/` and from the home page itself.
       Next merges metadata *shallowly*: a segment that declares `openGraph`
       replaces the parent's object whole, so it inherits no image either and
       the fallback card has to be named here. */
    openGraph: { url, title, description: copy.description, images: [copy.card] },
  };
};

interface VideoCatalogueProps {
  /** `null` renders «Все» — the union of the four sub-categories. */
  segment: FilmCategorySegment | null;
  page: number;
  /** Subject filter; empty is «Все темы». */
  topics?: FilmTopicKey[];
}

/**
 * The film catalogue: `/video/` and each `/video/<segment>/` render this same
 * body, differing only in which category they scope to. It lives in the module
 * rather than in `app/` because two routes share it — the same split as
 * {@link FilmPage}, which `/[...slug]` dispatches to.
 */
export const VideoCatalogue = async ({ segment, page, topics = [] }: VideoCatalogueProps) => {
  const { items, totalPages } = await fetchVideoList({
    page,
    perPage: PER_PAGE,
    category: segment ? FILM_CATEGORIES[segment] : ALL_FILM_CATEGORY_IDS,
    tags: filmTopicIds(topics),
  });

  // A page past the end is not a page: `?page=999` answered 200 with zero
  // cards, a self-canonical and no `noindex` — an unbounded family of indexable
  // near-empties. Page 1 still renders «Фильмов не найдено», which is a real
  // answer about a real category (SEO-10).
  if (page > 1 && items.length === 0) {
    notFound();
  }

  const copy = copyFor(segment);
  const catalogueRoot = catalogueHref({ segment: null });
  const breadcrumbItems = segment
    ? [{ label: 'Главная', href: '/' }, { label: 'Видео', href: catalogueRoot }, { label: copy.label }]
    : [{ label: 'Главная', href: '/' }, { label: 'Видео' }];

  // Switching category keeps the topics: the two filters are different
  // questions about the same shelf, and dropping one because the other moved is
  // the behaviour that makes a filter pair annoying to use.
  const filterOptions: VideoFilterOption[] = CATALOGUE_KEYS.map((key) => ({
    label: CATALOGUE_COPY[key].label,
    value: key,
    href: catalogueHref({ segment: key === ALL ? null : key, topics }),
  }));

  return (
    <Box display="flex" flexDirection="column" gap={40} pt={20} pb={48}>
      <PageHeader title={copy.heading} breadcrumbs={breadcrumbItems} />

      <VideoFilter options={filterOptions} active={segment ?? ALL} />

      <TopicFilter selected={topics} buildHref={(next) => catalogueHref({ segment, topics: next })} />

      {items.length > 0 ? (
        <div className={css.list}>
          {items.map((film, index) => (
            <VideoCard
              key={film.id}
              // The first poster is the measured LCP element on both `/video/`
              // and every `/video/<segment>/` (PERF-03).
              priority={index === 0}
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
        <p className={css.empty}>
          {topics.length > 0 ? 'Фильмов по выбранным темам не найдено.' : 'Фильмов не найдено.'}
        </p>
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={(target) => catalogueHref({ segment, page: target, topics })}
      />

      <NewsletterSignup />
    </Box>
  );
};
