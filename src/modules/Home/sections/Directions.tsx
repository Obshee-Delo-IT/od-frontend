import { Heading } from '@radix-ui/themes';
import { Carousel } from '@/shared/ui/components/Carousel';
import { IllustratedCard } from '@/shared/ui/components/IllustratedCard';
import css from './Directions.module.css';

export interface DirectionCardData {
  id: string | number;
  title: string;
  href: string;
  Illustration: React.FC<React.SVGProps<SVGElement>>;
}

interface DirectionsProps {
  directions: DirectionCardData[];
  /**
   * `PROGRAMS_TITLE`/`DIRECTIONS_TITLE` when the home page draws the two
   * carousels Figma does, `HOME_SECTIONS_TITLE` when it folds them into one —
   * see `SPLIT_HOME_SECTIONS`. Named by `aria-label` rather than an `id`,
   * because the shape renders more than once per page either way.
   */
  title: string;
}

export const Directions: React.FC<DirectionsProps> = ({ directions, title }) => (
  <section className={css.section} aria-label={title}>
    <Heading as="h2" size="9" className={css.heading}>
      {title}
    </Heading>

    <Carousel
      ariaLabel={title}
      slidesPerView={3}
      spaceBetween={40}
      breakpoints={{
        0: { slidesPerView: 1.1, spaceBetween: 16 },
        900: { slidesPerView: 2, spaceBetween: 24 },
        1280: { slidesPerView: 3, spaceBetween: 40 },
      }}
      items={directions.map((direction) => (
        <IllustratedCard
          key={direction.id}
          title={direction.title}
          href={direction.href}
          Illustration={direction.Illustration}
        />
      ))}
    />
  </section>
);
