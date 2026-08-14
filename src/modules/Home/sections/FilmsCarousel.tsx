import { Heading } from '@radix-ui/themes';
import Image from 'next/image';
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

interface FilmsCarouselProps {
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
        <NextLink key={film.id} href={film.href} className={css.filmCard}>
          <div className={css.thumb}>
            {film.thumbnailUrl ? (
              <Image
                src={film.thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 900px) 90vw, (max-width: 1280px) 45vw, 397px"
                className={css.thumbImage}
              />
            ) : null}
          </div>
          <span className={css.filmTitle}>{film.title}</span>
        </NextLink>
      ))}
    />

    <div className={css.cta}>
      <Button variant="outline" size="large" asChild>
        <NextLink href="/video">Все фильмы</NextLink>
      </Button>
    </div>
  </section>
);
