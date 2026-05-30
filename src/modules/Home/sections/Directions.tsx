'use client';

import { Heading } from '@radix-ui/themes';
import { Carousel } from '@/shared/ui/components/Carousel';
import { Link } from '@/shared/ui/components/Link';
import css from './Directions.module.css';

export interface DirectionCardData {
  id: string | number;
  title: string;
  href: string;
}

export interface DirectionsProps {
  directions: DirectionCardData[];
}

export const Directions: React.FC<DirectionsProps> = ({ directions }) => (
  <section className={css.section} aria-labelledby="directions-heading">
    <Heading as="h2" id="directions-heading" size="9" className={css.heading}>
      Направления деятельности
    </Heading>

    <Carousel
      ariaLabel="Направления деятельности"
      slidesPerView={3}
      spaceBetween={40}
      breakpoints={{
        0: { slidesPerView: 1.1, spaceBetween: 16 },
        900: { slidesPerView: 2, spaceBetween: 24 },
        1280: { slidesPerView: 3, spaceBetween: 40 },
      }}
      items={directions.map((direction) => (
        <article key={direction.id} className={css.card}>
          <div className={css.illustration} aria-hidden="true" />
          <div className={css.body}>
            <h3 className={css.title}>{direction.title}</h3>
            <Link href={direction.href} color="red" underline="always" size="3">
              Подробнее
            </Link>
          </div>
        </article>
      ))}
    />
  </section>
);
