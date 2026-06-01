import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  Directions,
  FilmsCarousel,
  Hero,
  NarrowPromo,
  NewsGrid,
  Programs,
  StatsRow,
  type DirectionCardData,
  type ProgramCardData,
} from '@/modules/Home';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchFilms, fetchLatestNews } from '@/shared/api';
import { Box } from '@/shared/ui/components/Box';
import type { Metadata } from 'next';

export const revalidate = 3600;
export const dynamicParams = true;

export const metadata: Metadata = {
  title: 'ОБЩЕЕ ДЕЛО — общероссийская общественная организация',
  description: 'Поддержка президентских инициатив в области здоровьесбережения нации',
};

dayjs.locale('ru');

const DIRECTIONS: DirectionCardData[] = [
  { id: 1, title: 'Бизнес-клуб', href: '/projects/business-club' },
  { id: 2, title: 'Общее дело ПРО', href: 'https://od-pro.ru' },
  { id: 3, title: 'ОД ИТ', href: '/projects/od-it' },
  { id: 4, title: 'Наставничество', href: '/projects/mentorship' },
  { id: 5, title: 'Видеоматериалы', href: '/video' },
];

const PROGRAMS: ProgramCardData[] = [
  { id: 1, title: 'Здоровая Россия', href: '/programs/healthy-russia' },
  { id: 2, title: 'Здоровые дети', href: '/programs/healthy-children' },
  { id: 3, title: 'Здоровая молодёжь', href: '/programs/healthy-youth' },
];

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
          href: `/news/${film.id}`,
          thumbnailUrl: film.thumbnailUrl,
        }))}
      />
      <NarrowPromo />
      <Directions directions={DIRECTIONS} />
      <Programs programs={PROGRAMS} />
      <NewsGrid
        items={news.map((post) => ({
          id: post.id,
          title: post.title,
          href: `/news/${post.id}`,
          date: post.date ? dayjs(post.date).format('DD.MM.YYYY') : undefined,
          imageSrc: post.thumbnailUrl,
          imageAlt: post.title,
          excerpt: post.excerpt ?? undefined,
        }))}
      />
      <NewsletterSignup variant="card" />
    </Box>
  );
};

export default HomePage;
