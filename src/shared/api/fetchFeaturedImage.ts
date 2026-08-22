import { cache } from 'react';
import { postTag, WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';

/**
 * The editor-chosen lead image of one post, as a URL that answers 200.
 *
 * **Why a second request rather than `_embed`.** The post itself goes through
 * the typed client, and `_embed` is not in the generated schema — neither is
 * `/wp/v2/media` at all (`wp-openapi` omits it), which is also why this is a raw
 * `wpFetch`. One `_fields=source_url` round trip is the smaller price than
 * hand-rolling the whole post type to switch `fetchNews` to `wpFetch`, and
 * `cache()` collapses it to once per render pass.
 *
 * A missing attachment is an ordinary answer, not an error: WordPress keeps
 * `featured_media` pointing at an id whose file has been deleted, and the caller
 * has a fallback.
 */
export const fetchFeaturedImage = async (
  mediaId: number | undefined | null,
  postId: number | string
): Promise<string | null> => {
  if (!mediaId) {
    return null;
  }
  const res = await wpFetch(`/wp/v2/media/${mediaId}?_fields=source_url`, wpCache([WP_TAGS.posts, postTag(postId)]));
  if (!res.ok) {
    return null;
  }
  const raw = (await res.json()) as { source_url?: string } | null;
  return resolveMediaUrl(raw?.source_url);
};

export const cachedFetchFeaturedImage = cache(fetchFeaturedImage);
