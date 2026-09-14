import { Heading } from '@radix-ui/themes';
import Image, { type StaticImageData } from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { AddOutlinedIcon } from '@/shared/ui/components/Icons';
import photo1 from './hero-photos/1.png';
import photo10 from './hero-photos/10.png';
import photo2 from './hero-photos/2.png';
import photo3 from './hero-photos/3.png';
import photo4 from './hero-photos/4.png';
import photo5 from './hero-photos/5.png';
import photo6 from './hero-photos/6.png';
import photo7 from './hero-photos/7.png';
import photo8 from './hero-photos/8.png';
import photo9 from './hero-photos/9.png';
import css from './Hero.module.css';

// Three marquee rows, each with its own distinct set of photos (matching the
// Figma layout: 3 / 4 / 3 tiles across the top / middle / bottom rows). Each
// row's set is repeated across the track so the right-to-left scroll loops
// seamlessly — see TRACK_COPIES and the `-50%` translate in the CSS.
// Imported rather than referenced at `/figma/hero-photos/N.png`: a `public/`
// path is stable across builds, so the image optimizer's on-disk cache — a
// persistent volume, keyed on the URL and held for `minimumCacheTTL` — kept
// serving the previous export of tile 7 for a day after it was replaced. A
// static import is content-hashed, so a re-export is a new URL and a new key.
const ROWS = [
  [photo1, photo2, photo3],
  [photo4, photo5, photo6, photo7],
  [photo8, photo9, photo10],
];

// The track holds 4 copies of the row's set; the animation translates by 50%
// (two copies), so the second half is an exact duplicate of the first and the
// wrap is seamless. Four copies also guarantee the track overflows the widest
// viewport for the shorter (3-photo) rows. The tile count goes to the CSS as
// `--tiles`, which is what the track's width is computed from — `max-content`
// is sized differently by Firefox, see `Hero.module.css`.
const TRACK_COPIES = 4;

const PhotoTile: React.FC<{ photo: StaticImageData }> = ({ photo }) => (
  <div className={css.tile}>
    <Image
      src={photo}
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
          <div className={css.track} style={{ '--tiles': row.length * TRACK_COPIES } as React.CSSProperties}>
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
