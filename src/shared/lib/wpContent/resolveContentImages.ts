import { resolveMediaUrl } from '@/shared/api';

/**
 * `<audio>` rides along with `<img>` because it is the same problem:
 * `/materials/audio-roliki-social-reklama/` stores four mp3s in the uploads
 * tree, and a root-relative `/wp-content/…` src is a 404 on this origin.
 */
const MEDIA_TAG = /<(?:img|audio)\b[^>]*>/gi;
const SRC_ATTR = /\bsrc=["']([^"']+)["']/i;

/**
 * Rewrite every `<img>` and `<audio>` in a WordPress post's rendered HTML to the
 * resolved full-size / CDN URL — the same logic the card thumbnails use (see
 * resolveMediaUrl) — and strip `srcset`/`sizes` so the browser can't fall back
 * to a small variant (which is blurry, and on this install missing from the
 * CDN). Returns the HTML unchanged when there is no such media.
 *
 * **`eagerFirstImage` opts a body's first image out of lazy loading.** WordPress
 * marks every image in a body `loading="lazy"` (`wp_filter_content_tags`, at
 * render time — the attribute is not in `post_content`, so no content script can
 * reach it), and in a page's *main* body the first image is the largest thing
 * under the title: the left-hand cover on `/materials/metodichki/`, the hero on a
 * news article, the poster on a film page. That makes it the LCP candidate, and
 * lazy-loading the element the page is measured by is the one case the attribute
 * costs instead of saves. Everything below it stays lazy.
 *
 * It is off by default because not every body is a main body — a footer widget
 * also runs through here, and its logo is the last thing on the page.
 */
export const resolveContentImages = async (html?: string | null, eagerFirstImage = false): Promise<string> => {
  if (!html) {
    return '';
  }

  const sources = new Set<string>();
  for (const tag of html.match(MEDIA_TAG) ?? []) {
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

  let first = true;

  return html.replace(MEDIA_TAG, (tag) => {
    const src = tag.match(SRC_ATTR)?.[1];
    if (!src) {
      return tag;
    }
    const rewritten = tag
      .replace(SRC_ATTR, `src="${resolved.get(src) ?? src}"`)
      .replace(/\s+srcset=["'][^"']*["']/i, '')
      .replace(/\s+sizes=["'][^"']*["']/i, '');

    if (!eagerFirstImage || !first || !/^<img\b/i.test(tag)) {
      return rewritten;
    }
    first = false;

    return (
      rewritten
        .replace(/\s+loading=["'][^"']*["']/i, '')
        // `fetchPriority`, not `fetchpriority`: this HTML is never injected raw —
        // every consumer runs it through `html-react-parser`, and React 19 logs
        // «Invalid DOM property» for the lowercase spelling before rendering it.
        .replace(/<img\b/i, '<img loading="eager" fetchPriority="high"')
    );
  });
};
