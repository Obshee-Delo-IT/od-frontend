import platformRutube from '@/shared/ui/assets/images/platform-rutube.png';
import platformVkVideo from '@/shared/ui/assets/images/platform-vk-video.png';
import platformYoutube from '@/shared/ui/assets/images/platform-youtube.png';
import type { VideoShareLinks } from '@/shared/api';
import type { StaticImageData } from 'next/image';

/**
 * The three external video platforms a film can link out to (Figma `Frame
 * 33967`). The logos are the official brand marks exported from Figma at 4×
 * (they are raster image fills there — no vectors exist in the file);
 * `iconSize` is each logo's design size inside the 40px tile.
 */
const SHARE_PLATFORMS = [
  { key: 'vk', label: 'VK Видео', logo: platformVkVideo as StaticImageData, iconSize: 32 },
  { key: 'youtube', label: 'YouTube', logo: platformYoutube as StaticImageData, iconSize: 28 },
  { key: 'rutube', label: 'Rutube', logo: platformRutube as StaticImageData, iconSize: 32 },
] as const;

interface SharePlatformLink {
  key: (typeof SHARE_PLATFORMS)[number]['key'];
  label: string;
  logo: StaticImageData;
  iconSize: number;
  href: string;
}

/** Keep only the platforms whose link is actually set. */
export const resolveShareLinks = (share?: VideoShareLinks): SharePlatformLink[] =>
  SHARE_PLATFORMS.flatMap((platform) => {
    const href = share?.[platform.key];
    return href ? [{ ...platform, href }] : [];
  });
