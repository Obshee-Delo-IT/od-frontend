import { Directions, FilmsCarousel, Hero, NarrowPromo, NewsGrid, StatsRow } from '@/modules/Home';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchFilms, fetchLatestNews } from '@/shared/api';
import {
  DIRECTIONS,
  DIRECTIONS_TITLE,
  HOME_SECTIONS_TITLE,
  PROGRAMS,
  PROGRAMS_TITLE,
  SPLIT_HOME_SECTIONS,
} from '@/shared/config/programSections';
import { canonicalUrl } from '@/shared/config/site';
import { formatDate } from '@/shared/lib/formatDate';
import { Box } from '@/shared/ui/components/Box';
import type { Metadata } from 'next';

export const revalidate = 3600;
export const dynamicParams = true;

const TITLE = 'ОБЩЕЕ ДЕЛО — общероссийская общественная организация';
const DESCRIPTION = 'Поддержка президентских инициатив в области здоровьесбережения нации';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl('/') },
  openGraph: {
    url: canonicalUrl('/'),
    title: TITLE,
    description: DESCRIPTION,
  },
};

const HomePage = async () => {
  const [films, news] = await Promise.all([fetchFilms(6), fetchLatestNews(5)]);

  return (
    <Box display="flex" flexDirection="column" gap={48} py={48}>
      <Hero />
      <StatsRow />
      <FilmsCarousel
        films={films.map((film) => ({
          id: film.id,
          title: film.title,
          href: `/${film.id}`,
          thumbnailUrl: film.thumbnailUrl,
        }))}
      />
      <NarrowPromo />
      {SPLIT_HOME_SECTIONS ? (
        <>
          <Directions title={PROGRAMS_TITLE} directions={PROGRAMS} />
          <Directions title={DIRECTIONS_TITLE} directions={DIRECTIONS} />
        </>
      ) : (
        <Directions title={HOME_SECTIONS_TITLE} directions={[...PROGRAMS, ...DIRECTIONS]} />
      )}
      <NewsGrid
        items={news.map((post) => ({
          id: post.id,
          title: post.title,
          href: `/${post.id}`,
          date: formatDate(post.date) || undefined,
          imageSrc: post.thumbnailUrl,
          imageAlt: post.title,
          excerpt: post.excerpt ?? undefined,
        }))}
      />
      <NewsletterSignup />
    </Box>
  );
};

export default HomePage;
