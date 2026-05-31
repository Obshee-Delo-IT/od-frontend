'use client';

import { Heading } from '@radix-ui/themes';
import Program1 from '@/shared/ui/assets/illustrations/program-1.svg';
import Program2 from '@/shared/ui/assets/illustrations/program-2.svg';
import Program3 from '@/shared/ui/assets/illustrations/program-3.svg';
import { Carousel } from '@/shared/ui/components/Carousel';
import { Link } from '@/shared/ui/components/Link';
import css from './Programs.module.css';

const ILLUSTRATIONS = [Program1, Program2, Program3] as const;

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
      items={programs.map((program, idx) => {
        const Illustration = ILLUSTRATIONS[idx % ILLUSTRATIONS.length];
        return (
          <article key={program.id} className={css.card}>
            <div className={css.illustration}>
              <Illustration aria-hidden="true" />
            </div>
            <div className={css.body}>
              <h3 className={css.title}>{program.title}</h3>
              <Link
                href={program.href}
                color="red"
                underline="always"
                size="3"
                aria-label={`${program.title} — подробнее`}
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
