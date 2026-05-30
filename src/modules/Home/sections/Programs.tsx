'use client';

import { Heading } from '@radix-ui/themes';
import { Carousel } from '@/shared/ui/components/Carousel';
import { Link } from '@/shared/ui/components/Link';
import css from './Programs.module.css';

export interface ProgramCardData {
  id: string | number;
  title: string;
  href: string;
}

export interface ProgramsProps {
  programs: ProgramCardData[];
}

export const Programs: React.FC<ProgramsProps> = ({ programs }) => (
  <section className={css.section} aria-labelledby="programs-heading">
    <Heading as="h2" id="programs-heading" size="9" className={css.heading}>
      Программы
    </Heading>

    <Carousel
      ariaLabel="Программы"
      slidesPerView={3}
      spaceBetween={40}
      breakpoints={{
        0: { slidesPerView: 1.1, spaceBetween: 16 },
        900: { slidesPerView: 2, spaceBetween: 24 },
        1280: { slidesPerView: 3, spaceBetween: 40 },
      }}
      items={programs.map((program) => (
        <article key={program.id} className={css.card}>
          <div className={css.illustration} aria-hidden="true" />
          <div className={css.body}>
            <h3 className={css.title}>{program.title}</h3>
            <Link href={program.href} color="red" underline="always" size="3">
              Подробнее
            </Link>
          </div>
        </article>
      ))}
    />
  </section>
);
