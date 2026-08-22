import { Heading } from '@radix-ui/themes';
import Image from 'next/image';
import NextLink from 'next/link';
import { Carousel } from '@/shared/ui/components/Carousel';
import { resolveShareLinks } from '../sharePlatforms';
import css from './RelatedFilms.module.css';
import type { VideoShareLinks } from '@/shared/api';

interface RelatedFilmData {
  id: number;
  title: string;
  href: string;
  thumbnailUrl?: string | null;
  share?: VideoShareLinks;
}

interface RelatedFilmsProps {
  films: RelatedFilmData[];
  heading?: string;
}

/**
 * The «Рекомендуем к посмотру» strip at the bottom of the film page (Figma
 * `Frame 33815`): 16:9 poster cards with a title + share-platform icon row,
 * scoped to films of the same sub-category.
 */
export const RelatedFilms: React.FC<RelatedFilmsProps> = ({ films, heading = 'Рекомендуем к посмотру' }) => {
  if (films.length === 0) {
    return null;
  }

  return (
    <section className={css.section} aria-labelledby="related-films-heading">
      <Heading as="h2" id="related-films-heading" className={css.heading}>
        {heading}
      </Heading>

      <Carousel
        ariaLabel={heading}
        slidesPerView={3}
        spaceBetween={40}
        breakpoints={{
          0: { slidesPerView: 1.1, spaceBetween: 16 },
          900: { slidesPerView: 2, spaceBetween: 24 },
          1280: { slidesPerView: 3, spaceBetween: 40 },
        }}
        items={films.map((film) => {
          const shareLinks = resolveShareLinks(film.share);

          return (
            <article key={film.id} className={css.filmCard}>
              <NextLink href={film.href} className={css.thumb} aria-label={film.title}>
                {film.thumbnailUrl ? (
                  <Image
                    src={film.thumbnailUrl}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 90vw, (max-width: 1280px) 45vw, 387px"
                    className={css.thumbImage}
                  />
                ) : null}
              </NextLink>
              <span className={css.meta}>
                <NextLink href={film.href} className={css.filmTitle}>
                  {film.title}
                </NextLink>
                {shareLinks.length > 0 ? (
                  <span className={css.shareRow}>
                    {shareLinks.map(({ key, label, logo, iconSize, href }) => (
                      <NextLink
                        key={key}
                        href={href}
                        className={css.shareTile}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${film.title} — ${label}`}
                      >
                        {/* 0.7 = the 28px card tile vs the 40px strip tile in Figma. */}
                        <Image
                          src={logo}
                          alt=""
                          width={Math.round(iconSize * 0.7)}
                          height={Math.round(iconSize * 0.7)}
                        />
                      </NextLink>
                    ))}
                  </span>
                ) : null}
              </span>
            </article>
          );
        })}
      />
    </section>
  );
};
