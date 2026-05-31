import { Heading } from '@radix-ui/themes';
import Image from 'next/image';
import { Button } from '@/shared/ui/components/Button';
import { AddOutlinedIcon } from '@/shared/ui/components/Icons';
import css from './Hero.module.css';

const TILES = Array.from({ length: 10 }, (_, i) => i + 1);

export const Hero: React.FC = () => (
  <section className={css.hero} aria-labelledby="hero-heading">
    <div className={css.copy}>
      <Heading as="h1" id="hero-heading" className={css.heading}>
        Здоровая Россия — общее дело
      </Heading>
      <div className={css.actions}>
        <Button variant="contained" size="large" asChild>
          <a href="https://xn--d1aadek5agm.xn----9sbkcac6brh7h.xn--p1ai/" target="_blank" rel="noopener noreferrer">
            Оказать помощь
          </a>
        </Button>
        <Button variant="outline" size="large" asChild>
          <a href="https://obshee-delo.ru/get-involved/" target="_blank" rel="noopener noreferrer">
            <AddOutlinedIcon size={20} aria-hidden="true" />
            Прими участие
          </a>
        </Button>
      </div>
    </div>
    <div className={css.mosaic} aria-hidden="true">
      {TILES.map((n) => (
        <div key={n} className={css.tile} data-tile={n}>
          <Image src={`/figma/hero-photos/${n}.png`} alt="" fill sizes="222px" className={css.tileImage} />
        </div>
      ))}
    </div>
  </section>
);
