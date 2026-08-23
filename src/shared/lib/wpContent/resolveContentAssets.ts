import { resolveMediaUrl } from '@/shared/api';

/**
 * `<audio>` rides along with `<img>` because it is the same problem:
 * `/materials/audio-roliki-social-reklama/` stores four mp3s in the uploads
 * tree, and a root-relative `/wp-content/…` src is a 404 on this origin.
 */
const MEDIA_TAG = /<(?:img|audio)\b[^>]*>/gi;
const SRC_ATTR = /\bsrc=["']([^"']+)["']/i;

/**
 * The `<a>` WordPress wraps an image in when the editor picks "link to media
 * file". Its href is the **full-size** upload — the thing the lightbox should
 * open — while the `<img src>` beside it is a small preview the editor chose,
 * and on the materials pages the two are different files, not two sizes of one.
 *
 * Left alone, that href is a 404: it is stored root-relative and resolves
 * against *this* origin, and `resolveContentLinks` deliberately does not root
 * the `wp-content` tree because it exists only on the WordPress host. Sending
 * it through the same resolver as the `src` is what makes it a real address.
 */
const MEDIA_HREF = /<a\b[^>]*\bhref=["']([^"']*\/wp-content\/uploads\/[^"']*)["'][^>]*>/gi;
const HREF_ATTR = /\bhref=["']([^"']+)["']/i;

/**
 * Whether an `<img>` already carries a `loading` attribute. Absence is the
 * problem this file has to fix, not a neutral default — see `resolveContentAssets`.
 */
const LOADING_ATTR = /\bloading=["'][^"']*["']/i;

/** Matches `experimental.staticGenerationMaxConcurrency` and every other pool aimed at this host. */
const PROBE_CONCURRENCY = 4;

/**
 * Rewrite every `<img>`, `<audio>` and media `<a href>` in a WordPress post's
 * rendered HTML to the resolved full-size / CDN URL — the same logic the card thumbnails use (see
 * resolveMediaUrl) — and strip `srcset`/`sizes` so the browser can't fall back
 * to a small variant (which is blurry, and on this install missing from the
 * CDN). Returns the HTML unchanged when there is no such media.
 *
 * **Every image below the first is forced `loading="lazy"`.** WordPress *usually*
 * lazy-loads a body's images (`wp_filter_content_tags`, at render time — the
 * attribute is not in `post_content`, so no content script can reach it), but not
 * always: `/about/` comes back with six `<img>` carrying no `loading` at all, and
 * an image without the attribute is eager. That is not merely a slower image. Next
 * ships preload hints for non-lazy images inside the route's flight payload, so
 * the App Router's prefetch of a nav link executes them — measured 2026-08-21,
 * every page on the site fetched `/about/`'s seven partner logos and certificates
 * from the media bucket, up to 1.6 s each, for images the visitor never sees.
 * Blocking `/about/?_rsc=` alone took it to zero. Setting the attribute ourselves
 * is what makes that independent of whatever WordPress decided.
 *
 * **`eagerFirstImage` opts a body's first image out of it.** In a page's *main*
 * body the first image is the largest thing under the title: the left-hand cover
 * on `/materials/metodichki/`, the hero on a news article, the poster on a film
 * page. That makes it the LCP candidate, and lazy-loading the element the page is
 * measured by is the one case the attribute costs instead of saves.
 *
 * It is off by default because not every body is a main body — a footer widget
 * also runs through here, and its logo is the last thing on the page.
 */
export const resolveContentAssets = async (html?: string | null, eagerFirstImage = false): Promise<string> => {
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
  for (const tag of html.match(MEDIA_HREF) ?? []) {
    const href = tag.match(HREF_ATTR)?.[1];
    if (href) {
      sources.add(href);
    }
  }
  if (sources.size === 0) {
    return html;
  }

  const resolved = new Map<string, string>();
  // Gated, not a bare `Promise.all` over the whole set: each miss is a HEAD
  // probe against the media host, and one real body fired 54 of them at once
  // against the 4 that next.config.ts, sitemap.ts and legacyStore.ts all chose
  // for the same host — which is where its 503s start (PERF-05).
  const pending = [...sources];
  const worker = async () => {
    for (let src = pending.pop(); src !== undefined; src = pending.pop()) {
      resolved.set(src, (await resolveMediaUrl(src)) ?? src);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, pending.length) }, worker));

  const withHrefs = html.replace(MEDIA_HREF, (tag) => {
    const href = tag.match(HREF_ATTR)?.[1];

    return href ? tag.replace(HREF_ATTR, `href="${resolved.get(href) ?? href}"`) : tag;
  });

  let first = true;

  return withHrefs.replace(MEDIA_TAG, (tag) => {
    const src = tag.match(SRC_ATTR)?.[1];
    if (!src) {
      return tag;
    }
    const rewritten = tag
      .replace(SRC_ATTR, `src="${resolved.get(src) ?? src}"`)
      .replace(/\s+srcset=["'][^"']*["']/i, '')
      .replace(/\s+sizes=["'][^"']*["']/i, '');

    // `<audio>` rides this path too, and `loading` means nothing on it.
    if (!/^<img\b/i.test(tag)) {
      return rewritten;
    }

    if (eagerFirstImage && first) {
      first = false;

      return (
        rewritten
          .replace(/\s+loading=["'][^"']*["']/i, '')
          // `fetchPriority`, not `fetchpriority`: this HTML is never injected raw —
          // every consumer runs it through `html-react-parser`, and React 19 logs
          // «Invalid DOM property» for the lowercase spelling before rendering it.
          .replace(/<img\b/i, '<img loading="eager" fetchPriority="high"')
      );
    }

    return LOADING_ATTR.test(rewritten) ? rewritten : rewritten.replace(/<img\b/i, '<img loading="lazy"');
  });
};
