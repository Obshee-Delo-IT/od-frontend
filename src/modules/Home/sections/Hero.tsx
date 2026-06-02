import { Heading } from '@radix-ui/themes';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { AddOutlinedIcon } from '@/shared/ui/components/Icons';
import css from './Hero.module.css';

// Three marquee rows, each with its own distinct set of photos (matching the
// Figma layout: 3 / 4 / 3 tiles across the top / middle / bottom rows). Each
// row's set is repeated across the track so the right-to-left scroll loops
// seamlessly — see TRACK_COPIES and the `-50%` translate in the CSS.
const ROWS = [
  [1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10],
];

// The track holds 4 copies of the row's set; the animation translates by 50%
// (two copies), so the second half is an exact duplicate of the first and the
// wrap is seamless. Four copies also guarantee the track overflows the widest
// viewport for the shorter (3-photo) rows.
const TRACK_COPIES = 4;

const PhotoTile: React.FC<{ photo: number }> = ({ photo }) => (
  <div className={css.tile}>
    <Image
      src={`/figma/hero-photos/${photo}.png`}
      alt=""
      fill
      sizes="(max-width: 900px) 180px, (max-width: 1440px) 200px, 222px"
      className={css.tileImage}
    />
  </div>
);

export const Hero: React.FC = () => (
  <section className={css.hero} aria-labelledby="hero-heading">
    <div className={css.photos} aria-hidden="true">
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className={css.row} data-row={rowIndex}>
          <div className={css.track}>
            {Array.from({ length: TRACK_COPIES }, () => row)
              .flat()
              .map((photo, i) => (
                <PhotoTile key={`${rowIndex}-${i}`} photo={photo} />
              ))}
          </div>
        </div>
      ))}
    </div>
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
          <NextLink href="/get-involved">
            <AddOutlinedIcon size={20} aria-hidden="true" />
            Прими участие
          </NextLink>
        </Button>
      </div>
    </div>
  </section>
);
