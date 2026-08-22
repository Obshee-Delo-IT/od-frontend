import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { CirclePlayIcon, DownloadIcon } from '@/shared/ui/components/Icons';
import { resolveShareLinks } from '../sharePlatforms';
import css from './FilmActions.module.css';
import type { VideoDownload, VideoShareLinks } from '@/shared/api';

interface FilmActionsProps {
  trailerUrl?: string | null;
  /** Download pills — ACF slots first, plus any body-lifted fallback variants. */
  downloads?: VideoDownload[];
  share?: VideoShareLinks;
  className?: string;
}

/**
 * The white strip under the film player (Figma `Frame 33967`/`Frame 33958`):
 * «Смотреть онлайн» platform tiles on the left, the «Скачать фильм бесплатно»
 * pills (plus trailer) on the right. Every affordance renders only when its
 * field is populated; the strip disappears entirely when the film has none.
 */
export const FilmActions: React.FC<FilmActionsProps> = ({ trailerUrl, downloads = [], share, className }) => {
  const shareLinks = resolveShareLinks(share);

  if (downloads.length === 0 && !trailerUrl && shareLinks.length === 0) {
    return null;
  }

  return (
    <section className={clsx(css.root, className)} aria-label="Смотреть и скачать фильм">
      {shareLinks.length > 0 ? (
        <div className={css.watch}>
          <Text as="div" className={css.label}>
            Смотреть онлайн
          </Text>
          <div className={css.shareRow}>
            {shareLinks.map(({ key, label, logo, iconSize, href }) => (
              <NextLink key={key} href={href} className={css.shareItem} target="_blank" rel="noopener noreferrer">
                <span className={css.shareTile}>
                  <Image src={logo} alt="" width={iconSize} height={iconSize} />
                </span>
                <span className={css.shareLabel}>{label}</span>
              </NextLink>
            ))}
          </div>
        </div>
      ) : null}

      {downloads.length > 0 || trailerUrl ? (
        <div className={css.downloads}>
          {downloads.length > 0 ? (
            <Text as="div" className={css.label}>
              Скачать фильм бесплатно
            </Text>
          ) : null}
          <div className={css.pills}>
            {downloads.map(({ url, label }) => (
              <Button key={url} variant="outline" size="xs" asChild className={css.pill}>
                <NextLink href={url} target="_blank" rel="noopener noreferrer">
                  {label}
                  <DownloadIcon size={20} aria-hidden="true" />
                </NextLink>
              </Button>
            ))}
            {trailerUrl ? (
              <Button variant="outline" size="xs" asChild className={css.pill}>
                <NextLink href={trailerUrl} target="_blank" rel="noopener noreferrer">
                  Трейлер
                  <CirclePlayIcon size={20} aria-hidden="true" />
                </NextLink>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
