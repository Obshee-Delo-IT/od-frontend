import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { CirclePlayIcon } from '@/shared/ui/components/Icons';
import css from './FilmPlayer.module.css';

export interface FilmPlayerProps {
  /** Accessible name for the player / poster. */
  title: string;
  /** Kinescope video id — renders the on-site embed when set (E4). */
  kinescopeId?: string | null;
  /** External «Смотреть онлайн» page — poster links out when there's no embed. */
  watchUrl?: string | null;
  posterUrl?: string | null;
  className?: string;
}

/**
 * The film-page hero (16:9): a Kinescope embed when the post carries a
 * `kinescope_id`, otherwise the poster linking out to `watch_url`, otherwise
 * the bare poster. Renders nothing when there is neither a stream nor a poster
 * (the download pills below are then the only affordance).
 */
export const FilmPlayer: React.FC<FilmPlayerProps> = ({ title, kinescopeId, watchUrl, posterUrl, className }) => {
  if (kinescopeId) {
    return (
      <div className={clsx(css.frame, className)}>
        {/* The Kinescope player needs scripts + its own origin (API/DRM), which a
            sandbox can't grant without being self-defeating — so, like YouTube/VK
            embeds, it runs unsandboxed; kinescope.io is our contracted player host. */}
        {/* eslint-disable-next-line react/iframe-missing-sandbox */}
        <iframe
          className={css.iframe}
          src={`https://kinescope.io/embed/${encodeURIComponent(kinescopeId)}`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;"
          allowFullScreen
        />
      </div>
    );
  }

  const poster = posterUrl ? (
    <Image src={posterUrl} alt="" fill sizes="(max-width: 900px) 100vw, 1240px" className={css.poster} priority />
  ) : null;

  if (watchUrl) {
    return (
      <NextLink
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(css.frame, css.watchLink, className)}
        aria-label={`Смотреть онлайн: ${title}`}
      >
        {poster}
        <span className={css.overlay}>
          <CirclePlayIcon size={64} aria-hidden="true" />
          <span className={css.overlayLabel}>Смотреть онлайн</span>
        </span>
      </NextLink>
    );
  }

  if (!poster) {
    return null;
  }

  return <div className={clsx(css.frame, className)}>{poster}</div>;
};
