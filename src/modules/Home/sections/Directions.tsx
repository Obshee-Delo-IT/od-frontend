import { Heading } from '@radix-ui/themes';
import Direction1 from '@/shared/ui/assets/illustrations/direction-1.svg';
import Direction2 from '@/shared/ui/assets/illustrations/direction-2.svg';
import Direction3 from '@/shared/ui/assets/illustrations/direction-3.svg';
import Direction4 from '@/shared/ui/assets/illustrations/direction-4.svg';
import Direction5 from '@/shared/ui/assets/illustrations/direction-5.svg';
import { Carousel } from '@/shared/ui/components/Carousel';
import { Link } from '@/shared/ui/components/Link';
import css from './Directions.module.css';

const ILLUSTRATIONS = [Direction1, Direction2, Direction3, Direction4, Direction5] as const;

export interface DirectionCardData {
  id: string | number;
  title: string;
  href: string;
}

interface DirectionsProps {
  directions: DirectionCardData[];
  /**
   * `HOME_SECTIONS_TITLE` on the home page, where the two lists are folded into
   * one carousel; `PROGRAMS_TITLE` / `DIRECTIONS_TITLE` on `/projects/`, which
   * renders this twice. The section is named by `aria-label` rather than an
   * `id` for exactly that reason — two copies would collide on one.
   */
  title: string;
  /**
   * Where in {@link ILLUSTRATIONS} this section's cards start. `/projects/`
   * renders two sections that are one list in Figma, so the second passes the
   * first's length and the five drawings stay distinct — without it both
   * sections restart at Direction1, repeating two drawings *and* their internal
   * SVG ids.
   */
  illustrationOffset?: number;
}

export const Directions: React.FC<DirectionsProps> = ({ directions, title, illustrationOffset = 0 }) => (
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
      items={directions.map((direction, idx) => {
        const Illustration = ILLUSTRATIONS[(idx + illustrationOffset) % ILLUSTRATIONS.length];
        return (
          <article key={direction.id} className={css.card}>
            <div className={css.illustration}>
              <Illustration aria-hidden="true" />
            </div>
            <div className={css.body}>
              <h3 className={css.title}>{direction.title}</h3>
              <Link
                href={direction.href}
                color="red"
                underline="always"
                size="3"
                aria-label={`${direction.title} — подробнее`}
              >
                Подробнее
              </Link>
            </div>
          </article>
        );
      })}
    />
  </section>
);
