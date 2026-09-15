import { cache } from 'react';
import { postTag, WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';

/** A post's lead image: a URL that answers 200, and its pixels when WP knows them. */
export interface FeaturedImage {
  url: string;
  width?: number;
  height?: number;
}

/**
 * The editor-chosen lead image of one post, as a URL that answers 200.
 *
 * **Why a second request rather than `_embed`.** The post itself goes through
 * the typed client, and `_embed` is not in the generated schema — neither is
 * `/wp/v2/media` at all (`wp-openapi` omits it), which is also why this is a raw
 * `wpFetch`. One `_fields`-narrowed round trip is the smaller price than
 * hand-rolling the whole post type to switch `fetchNews` to `wpFetch`, and
 * `cache()` collapses it to once per render pass.
 *
 * A missing attachment is an ordinary answer, not an error: WordPress keeps
 * `featured_media` pointing at an id whose file has been deleted, and the caller
 * has a fallback.
 *
 * **`media_details` whole, never `media_details.width`.** WP's nested `_fields`
 * filter cannot descend into it — the attachment schema declares it as a bare
 * `object` with no `properties`, so the dotted form drops the sub-object
 * silently and the response comes back the same 91 bytes as without it. The
 * whole thing is 5.6 kB (26 `sizes` entries), once per post render behind
 * ISR — and it is what puts `og:image:width` on the card, which is how a
 * crawler lays the card out on the first share rather than the second.
 */
export const fetchFeaturedImage = async (
  mediaId: number | undefined | null,
  postId: number | string
): Promise<FeaturedImage | null> => {
  if (!mediaId) {
    return null;
  }
  const res = await wpFetch(
    `/wp/v2/media/${mediaId}?_fields=source_url,media_details`,
    wpCache([WP_TAGS.posts, postTag(postId)])
  );
  if (!res.ok) {
    return null;
  }
  const raw = (await res.json()) as { source_url?: string; media_details?: { width?: number; height?: number } } | null;
  const url = await resolveMediaUrl(raw?.source_url);
  if (!url) {
    return null;
  }

  // The CDN copy is the origin copy, not a derivative (the bucket transforms
  // nothing), and `source_url` is always the full-size or `-scaled` original —
  // so these pixels describe the URL being advertised, whichever host serves it.
  return { url, width: raw?.media_details?.width, height: raw?.media_details?.height };
};

export const cachedFetchFeaturedImage = cache(fetchFeaturedImage);
