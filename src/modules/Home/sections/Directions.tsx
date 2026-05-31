'use client';

import { Heading } from '@radix-ui/themes';
import Direction1 from '@/shared/ui/assets/illustrations/direction-1.svg';
import Direction2 from '@/shared/ui/assets/illustrations/direction-2.svg';
import Direction3 from '@/shared/ui/assets/illustrations/direction-3.svg';
import { Carousel } from '@/shared/ui/components/Carousel';
import { Link } from '@/shared/ui/components/Link';
import css from './Directions.module.css';

const ILLUSTRATIONS = [Direction1, Direction2, Direction3] as const;

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
      items={directions.map((direction, idx) => {
        const Illustration = ILLUSTRATIONS[idx % ILLUSTRATIONS.length];
        return (
          <article key={direction.id} className={css.card}>
            <div className={css.illustration}>
              <Illustration aria-hidden="true" />
            </div>
            <div className={css.body}>
              <h3 className={css.title}>{direction.title}</h3>
              <Link href={direction.href} color="red" underline="always" size="3">
                Подробнее
              </Link>
            </div>
          </article>
        );
      })}
    />
  </section>
);
