import { Heading, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { DownloadIcon, RutubeIcon, VkIcon, YoutubeIcon } from '@/shared/ui/components/Icons';
import css from './VideoCard.module.css';
import type { VideoDownload, VideoShareLinks } from '@/shared/api';

export interface VideoCardProps {
  title: string;
  date?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  excerpt?: string | null;
  /** «Смотреть онлайн» destination — wraps the poster when present. */
  watchUrl?: string | null;
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

const formatMeta = ({ duration, size }: VideoDownload): string | null =>
  [duration, size].filter(Boolean).join(' · ') || null;

/**
 * Horizontal film card for the `/video` catalogue: poster, title/excerpt, the
 * two optional download cuts (full / short) and a social-share row. Every
 * affordance renders only when its underlying field is non-empty — most films
 * currently expose just a full-version download.
 */
export const VideoCard: React.FC<VideoCardProps> = ({
  title,
  date,
  imageSrc,
  imageAlt = '',
  excerpt,
  watchUrl,
  downloadFull,
  downloadShort,
  share,
  className,
}) => {
  const downloads = [downloadFull, downloadShort].filter((d): d is VideoDownload => Boolean(d));
  const shareLinks = SHARE_PLATFORMS.map((p) => ({ ...p, href: share?.[p.key] ?? null })).filter((p) => p.href);

  const poster = (
    <div className={css.media}>
      {imageSrc ? (
        <Image src={imageSrc} alt={imageAlt} fill className={css.image} sizes="(max-width: 900px) 100vw, 320px" />
      ) : null}
    </div>
  );

  return (
    <article className={clsx(css.card, className)}>
      {watchUrl ? (
        <NextLink href={watchUrl} className={css.posterLink} aria-label={`Смотреть «${title}»`}>
          {poster}
        </NextLink>
      ) : (
        poster
      )}

      <div className={css.body}>
        <div className={css.heading}>
          {date ? (
            <Text as="div" size="2" color="gray" className={css.date}>
              {date}
            </Text>
          ) : null}
          <Heading as="h3" size="5" weight="bold" className={css.title}>
            {title}
          </Heading>
          {excerpt ? (
            <Text as="p" size="3" className={css.excerpt}>
              {excerpt}
            </Text>
          ) : null}
        </div>

        {downloads.length > 0 ? (
          <div className={css.downloads}>
            <Text as="div" weight="bold" className={css.downloadsLabel}>
              Скачать фильм бесплатно
            </Text>
            <div className={css.downloadButtons}>
              {downloads.map((download, index) => {
                const meta = formatMeta(download);
                return (
                  <NextLink
                    key={download.url}
                    href={download.url}
                    className={css.downloadButton}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <DownloadIcon size={20} />
                    <span className={css.downloadText}>
                      <span className={css.downloadTitle}>{index === 0 ? 'Полная версия' : 'Короткая версия'}</span>
                      {meta ? <span className={css.downloadMeta}>{meta}</span> : null}
                    </span>
                  </NextLink>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {shareLinks.length > 0 ? (
        <div className={css.share}>
          {shareLinks.map(({ key, label, Icon, href }) => (
            <NextLink
              key={key}
              href={href as string}
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
    </article>
  );
};
