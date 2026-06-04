import { Heading, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import {
  ArrowRightIcon,
  CirclePlayIcon,
  DownloadIcon,
  RutubeIcon,
  VkIcon,
  YoutubeIcon,
} from '@/shared/ui/components/Icons';
import css from './VideoCard.module.css';
import type { VideoDownload, VideoShareLinks } from '@/shared/api';

export interface VideoCardProps {
  title: string;
  /** Detail/permalink — wraps the poster and the «О фильме» button. */
  href: string;
  imageSrc?: string | null;
  imageAlt?: string;
  description?: string | null;
  trailerUrl?: string | null;
  downloadFull?: VideoDownload | null;
  downloadShort?: VideoDownload | null;
  share?: VideoShareLinks;
  className?: string;
}

const SHARE_PLATFORMS = [
  { key: 'vk', label: 'VK Видео', Icon: VkIcon },
  { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
  { key: 'rutube', label: 'Rutube', Icon: RutubeIcon },
] as const;

/** «Полн. версия • 54 мин» — quality prefix plus the free-text duration when set. */
const downloadLabel = (prefix: string, { duration }: VideoDownload): string =>
  duration ? `${prefix} • ${duration}` : prefix;

/**
 * Horizontal film card for the `/video` catalogue (Figma `Frame 21`): a white
 * surface holding the poster + social-share row (left), the title/description
 * and «О фильме» / «Трейлер» actions (centre), and the download pills (right).
 * Trailer, downloads and share links render only when their field is set — most
 * films currently expose just a full-version download.
 */
export const VideoCard: React.FC<VideoCardProps> = ({
  title,
  href,
  imageSrc,
  imageAlt = '',
  description,
  trailerUrl,
  downloadFull,
  downloadShort,
  share,
  className,
}) => {
  const downloads = [
    downloadFull && { prefix: 'Полн. версия', download: downloadFull },
    downloadShort && { prefix: 'Сокр. версия', download: downloadShort },
  ].filter((d): d is { prefix: string; download: VideoDownload } => Boolean(d));
  const shareLinks = SHARE_PLATFORMS.map((p) => ({ ...p, href: share?.[p.key] ?? null })).filter((p) => p.href);

  return (
    <article className={clsx(css.card, className)}>
      <div className={css.left}>
        <NextLink href={href} className={css.poster} aria-label={title}>
          {imageSrc ? (
            <Image src={imageSrc} alt={imageAlt} fill className={css.image} sizes="(max-width: 900px) 100vw, 368px" />
          ) : null}
        </NextLink>

        {shareLinks.length > 0 ? (
          <div className={css.share}>
            {shareLinks.map(({ key, label, Icon, href: shareHref }) => (
              <NextLink
                key={key}
                href={shareHref as string}
                className={css.shareItem}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={css.shareTile}>
                  <Icon size={28} />
                </span>
                <span className={css.shareLabel}>{label}</span>
              </NextLink>
            ))}
          </div>
        ) : null}
      </div>

      <div className={css.main}>
        <Heading as="h3" className={css.title}>
          {title}
        </Heading>
        {description ? (
          <Text as="p" className={css.description}>
            {description}
          </Text>
        ) : null}

        <div className={css.actions}>
          <Button variant="outline" size="small" asChild className={css.pill}>
            <NextLink href={href}>
              О фильме
              <ArrowRightIcon size={20} aria-hidden="true" />
            </NextLink>
          </Button>
          {trailerUrl ? (
            <Button variant="outline" size="small" asChild className={css.pill}>
              <NextLink href={trailerUrl} target="_blank" rel="noopener noreferrer">
                Трейлер
                <CirclePlayIcon size={20} aria-hidden="true" />
              </NextLink>
            </Button>
          ) : null}
        </div>
      </div>

      {downloads.length > 0 ? (
        <div className={css.downloads}>
          <Text as="div" className={css.downloadsLabel}>
            Скачать фильм бесплатно
          </Text>
          {downloads.map(({ prefix, download }) => (
            <Button
              key={download.url}
              variant="outline"
              size="small"
              asChild
              className={clsx(css.pill, css.downloadPill)}
            >
              <NextLink href={download.url} target="_blank" rel="noopener noreferrer">
                <span className={css.downloadText}>{downloadLabel(prefix, download)}</span>
                <DownloadIcon size={20} aria-hidden="true" />
              </NextLink>
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
};
