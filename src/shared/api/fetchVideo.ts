import { cache } from 'react';
import { mapVideoSummary, type RawVideoPost, type VideoSummary } from './fetchVideoList';
import { wpFetch } from './httpClient';

export interface VideoDetail extends VideoSummary {
  /** Rendered post body — the «О фильме» description (Gutenberg HTML). */
  contentHtml: string;
}

/**
 * Single film for the player page (canonical URL `/<id>`, see A8). Returns
 * `null` for a missing id or a post that isn't `format=video` (plain news ids
 * don't get a film page), so the route can `notFound()`.
 */
export const fetchVideo = async (id: string): Promise<VideoDetail | null> => {
  if (!/^\d+$/.test(id)) {
    return null;
  }

  const res = await wpFetch(`/wp/v2/posts/${id}?_embed=1`, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return null;
  }

  const post = (await res.json()) as RawVideoPost;
  if (!post?.id || post.format !== 'video') {
    return null;
  }

  const summary = await mapVideoSummary(post);
  return { ...summary, contentHtml: post.content?.rendered ?? '' };
};

/** Per-render dedup (page + generateMetadata), same pattern as cachedFetchNews. */
export const cachedFetchVideo = cache(fetchVideo);
