import { Heading } from '@radix-ui/themes';
import { Button } from '@/shared/ui/components/Button';
import { AddOutlinedIcon } from '@/shared/ui/components/Icons';
import css from './Hero.module.css';

export const Hero: React.FC = () => (
  <section className={css.hero} aria-labelledby="hero-heading">
    <div className={css.copy}>
      <Heading as="h1" id="hero-heading" className={css.heading}>
        Здоровая Россия — общее дело
      </Heading>
      <div className={css.actions}>
        <Button variant="contained" size="large">
          Оказать помощь
        </Button>
        <Button variant="outline" size="large">
          <AddOutlinedIcon size={20} aria-hidden="true" />
          Прими участие
        </Button>
      </div>
    </div>
    <div className={css.mosaic} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={css.tile} data-tile={i + 1} />
      ))}
    </div>
  </section>
);
