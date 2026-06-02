import { Heading } from '@radix-ui/themes';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { NewsFilter, type NewsFilterOption } from '@/modules/News';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchNewsList } from '@/shared/api';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { NewsCard } from '@/shared/ui/components/NewsCard';
import { Pagination } from '@/shared/ui/components/Pagination';
import css from './NewsListPage.module.css';
import type { Metadata } from 'next';

export const revalidate = 3600;

dayjs.locale('ru');

const PER_PAGE = 15;

// «Наши дела» has no dedicated WP category, so it maps to the main «Новости»
// category (47); «Статьи» is the articles category (578); «Все» is unfiltered.
const FILTER_OPTIONS: NewsFilterOption[] = [
  { label: 'Все', value: null },
  { label: 'Наши дела', value: 'nashi-dela' },
  { label: 'Статьи', value: 'articles' },
];

const CATEGORY_IDS: Record<string, number> = {
  'nashi-dela': 47,
  articles: 578,
};

export const metadata: Metadata = {
  title: 'Новости — ОБЩЕЕ ДЕЛО',
  description: 'Новости и статьи общероссийской общественной организации «Общее дело»',
};

interface NewsPageProps {
  searchParams: Promise<{ category?: string | string[]; page?: string | string[] }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const buildHref = ({ category, page }: { category: string | null; page: number }): string => {
  const query = new URLSearchParams();
  if (category) {
    query.set('category', category);
  }
  if (page > 1) {
    query.set('page', String(page));
  }
  const qs = query.toString();
  return qs ? `/news?${qs}` : '/news';
};

const Page = async ({ searchParams }: NewsPageProps) => {
  const params = await searchParams;

  const categoryParam = firstParam(params.category);
  const activeCategory = categoryParam && categoryParam in CATEGORY_IDS ? categoryParam : null;

  const pageParam = Number(firstParam(params.page));
  const currentPage = Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) : 1;

  const { items, totalPages } = await fetchNewsList({
    page: currentPage,
    perPage: PER_PAGE,
    category: activeCategory ? CATEGORY_IDS[activeCategory] : undefined,
  });

  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: 'Новости' }];

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <Breadcrumbs items={breadcrumbItems} />

      <Heading as="h1" className={css.heading}>
        Новости
      </Heading>

      <NewsFilter
        options={FILTER_OPTIONS}
        active={activeCategory}
        buildHref={(value) => buildHref({ category: value, page: 1 })}
      />

      {items.length > 0 ? (
        <div className={css.grid}>
          {items.map((post) => (
            <NewsCard
              key={post.id}
              href={`/news/${post.id}`}
              title={post.title}
              date={post.date ? dayjs(post.date).format('DD.MM.YYYY') : undefined}
              imageSrc={post.thumbnailUrl}
              imageAlt={post.title}
            />
          ))}
        </div>
      ) : (
        <p className={css.empty}>Новостей не найдено.</p>
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
