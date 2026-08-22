import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { DownloadIcon } from '@/shared/ui/components/Icons';
import css from './FilmPosterCard.module.css';

interface FilmPosterCardProps {
  /** Film title — used as the poster's alt text. */
  title: string;
  imageUrl?: string | null;
  /** CSS aspect-ratio of the artwork (e.g. `'212 / 300'`); portrait А2 by default. */
  imageAspectRatio?: string | null;
  downloadUrl?: string | null;
  className?: string;
}

/**
 * The white poster card beside the film description (Figma `Frame 33945`):
 * the printable «плакат» artwork plus its download link, both lifted out of
 * the legacy post body by `extractFilmPoster`. Renders nothing when the film
 * has neither.
 */
export const FilmPosterCard: React.FC<FilmPosterCardProps> = ({
  title,
  imageUrl,
  imageAspectRatio,
  downloadUrl,
  className,
}) => {
  if (!imageUrl && !downloadUrl) {
    return null;
  }

  return (
    <aside className={clsx(css.card, className)} aria-label={`Плакат фильма «${title}»`}>
      {imageUrl ? (
        <span className={css.posterFrame} style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined}>
          <Image
            src={imageUrl}
            alt={`Плакат фильма «${title}»`}
            fill
            sizes="(max-width: 900px) 100vw, 347px"
            className={css.poster}
          />
        </span>
      ) : null}
      {downloadUrl ? (
        <Button variant="outline" asChild className={css.download}>
          <NextLink href={downloadUrl} target="_blank" rel="noopener noreferrer">
            Скачать плакат
            <DownloadIcon size={20} aria-hidden="true" />
          </NextLink>
        </Button>
      ) : null}
    </aside>
  );
};
