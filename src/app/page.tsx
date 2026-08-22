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
import { canonicalUrl, OG_DEFAULT_IMAGE } from '@/shared/config/site';
import { formatDate } from '@/shared/lib/formatDate';
import { Box } from '@/shared/ui/components/Box';
import type { Metadata } from 'next';

export const revalidate = 3600;
export const dynamicParams = true;

const TITLE = 'ОБЩЕЕ ДЕЛО — общероссийская общественная организация';
/* Describes what the organisation *does*, not what it is called. The previous
   text — «Поддержка президентских инициатив в области здоровьесбережения
   нации» — is a slice of the registered legal name, which still has to appear
   verbatim wherever the law wants it (the footer's СМИ line, the privacy
   policy); a search snippet is not one of those places, and there it reads as a
   political statement rather than as a description of films and lessons. */
const DESCRIPTION =
  'Профилактика зависимостей и здоровый образ жизни: фильмы, методические материалы и занятия для школьников, студентов и родителей';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl('/') },
  openGraph: {
    url: canonicalUrl('/'),
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_DEFAULT_IMAGE],
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
