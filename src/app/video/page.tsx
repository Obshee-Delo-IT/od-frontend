import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { VideoCard, VideoFilter, type VideoFilterOption } from '@/modules/Video';
import { fetchVideoList } from '@/shared/api';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Pagination } from '@/shared/ui/components/Pagination';
import css from './VideoPage.module.css';
import type { Metadata } from 'next';

export const revalidate = 3600;

const PER_PAGE = 10;

// Children of the «Видео» (85) taxonomy — the category switcher set.
const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Фильмы', value: 'movies' },
  { label: 'Мультфильмы', value: 'mult' },
  { label: 'Ролики', value: 'roliki' },
  { label: 'Известные люди', value: 'famous' },
];

const CATEGORY_IDS: Record<string, number> = {
  movies: 581,
  mult: 580,
  roliki: 86,
  famous: 559,
};

// «Все» is the union of the four sub-categories, not every `format=video`
// post: the unfiltered query is dominated by «Видео события» (52) event
// reports, which aren't part of the film catalogue.
const ALL_CATEGORY_IDS = Object.values(CATEGORY_IDS);

export const metadata: Metadata = {
  title: 'Фильмы — ОБЩЕЕ ДЕЛО',
  description: 'Фильмы, мультфильмы и видеоролики общероссийской общественной организации «Общее дело»',
};

interface VideoPageProps {
  searchParams: Promise<{ category?: string | string[]; page?: string | string[] }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const buildHref = ({ category, page }: { category: string; page: number }): string => {
  const query = new URLSearchParams();
  if (category !== 'all') {
    query.set('category', category);
  }
  if (page > 1) {
    query.set('page', String(page));
  }
  const qs = query.toString();
  return qs ? `/video?${qs}` : '/video';
};

const Page = async ({ searchParams }: VideoPageProps) => {
  const params = await searchParams;

  const categoryParam = firstParam(params.category);
  const activeCategory = categoryParam && categoryParam in CATEGORY_IDS ? categoryParam : 'all';

  const pageParam = Number(firstParam(params.page));
  const currentPage = Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) : 1;

  const { items, totalPages } = await fetchVideoList({
    page: currentPage,
    perPage: PER_PAGE,
    category: activeCategory === 'all' ? ALL_CATEGORY_IDS : CATEGORY_IDS[activeCategory],
  });

  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: 'Фильмы' }];

  const filterOptions: VideoFilterOption[] = FILTER_OPTIONS.map((option) => ({
    ...option,
    href: buildHref({ category: option.value, page: 1 }),
  }));

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title="Фильмы Общего дела" breadcrumbs={breadcrumbItems} />

      <VideoFilter options={filterOptions} active={activeCategory} />

      {items.length > 0 ? (
        <div className={css.list}>
          {items.map((film) => (
            <VideoCard
              key={film.id}
              title={film.title}
              href={`/video/${film.id}`}
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
        currentPage={currentPage}
        totalPages={totalPages}
        buildHref={(page) => buildHref({ category: activeCategory, page })}
      />

      <NewsletterSignup variant="card" />
    </Box>
  );
};

export default Page;
