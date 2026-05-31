'use client';

import { Heading } from '@radix-ui/themes';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { Carousel } from '@/shared/ui/components/Carousel';
import css from './FilmsCarousel.module.css';

export interface FilmCardData {
  id: string | number;
  title: string;
  href: string;
  thumbnailUrl?: string | null;
}

export interface FilmsCarouselProps {
  films: FilmCardData[];
}

export const FilmsCarousel: React.FC<FilmsCarouselProps> = ({ films }) => (
  <section className={css.section} aria-labelledby="films-heading">
    <Heading as="h2" id="films-heading" size="9" className={css.heading}>
      Наши фильмы, мультфильмы и ролики
    </Heading>

    <Carousel
      ariaLabel="Фильмы и ролики"
      slidesPerView={3}
      spaceBetween={24}
      breakpoints={{
        0: { slidesPerView: 1.1, spaceBetween: 16 },
        900: { slidesPerView: 2, spaceBetween: 20 },
        1280: { slidesPerView: 3, spaceBetween: 24 },
      }}
      items={films.map((film) => (
        <a key={film.id} href={film.href} className={css.filmCard}>
          <div className={css.thumb}>
            {film.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={film.thumbnailUrl} alt="" className={css.thumbImage} />
            ) : null}
          </div>
          <span className={css.filmTitle}>{film.title}</span>
        </a>
      ))}
    />

    <div className={css.cta}>
      <Button variant="outline" size="large" asChild>
        <NextLink href="/video">Посмотреть все</NextLink>
      </Button>
    </div>
  </section>
);
