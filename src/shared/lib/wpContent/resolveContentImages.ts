import { resolveMediaUrl } from '@/shared/api';

const IMG_TAG = /<img\b[^>]*>/gi;
const SRC_ATTR = /\bsrc=["']([^"']+)["']/i;

/**
 * Rewrite every `<img>` in a WordPress post's rendered HTML to the resolved
 * full-size / CDN URL — the same logic the card thumbnails use (see
 * resolveMediaUrl) — and strip `srcset`/`sizes` so the browser can't fall back
 * to a small variant (which is blurry, and on this install missing from the
 * CDN). Returns the HTML unchanged when there are no images.
 */
export const resolveContentImages = async (html?: string | null): Promise<string> => {
  if (!html) {
    return '';
  }

  const sources = new Set<string>();
  for (const tag of html.match(IMG_TAG) ?? []) {
    const src = tag.match(SRC_ATTR)?.[1];
    if (src) {
      sources.add(src);
    }
  }
  if (sources.size === 0) {
    return html;
  }

  const resolved = new Map<string, string>();
  await Promise.all(
    [...sources].map(async (src) => {
      resolved.set(src, (await resolveMediaUrl(src)) ?? src);
    })
  );

  return html.replace(IMG_TAG, (tag) => {
    const src = tag.match(SRC_ATTR)?.[1];
    if (!src) {
      return tag;
    }
    return tag
      .replace(SRC_ATTR, `src="${resolved.get(src) ?? src}"`)
      .replace(/\s+srcset=["'][^"']*["']/i, '')
      .replace(/\s+sizes=["'][^"']*["']/i, '');
  });
};
