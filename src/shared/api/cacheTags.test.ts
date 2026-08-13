import { describe, expect, it } from 'vitest';
import { isWpTag, postTag, WP_REVALIDATE_SECONDS, WP_TAGS, wpCache } from './cacheTags';

describe('wpCache', () => {
  it('adds the site-wide tag to every request', () => {
    expect(wpCache([WP_TAGS.posts])).toEqual({
      next: { revalidate: WP_REVALIDATE_SECONDS, tags: [WP_TAGS.all, WP_TAGS.posts] },
    });
  });

  it('keeps the caller tags in order after it', () => {
    expect(wpCache([WP_TAGS.posts, WP_TAGS.films, postTag(42)]).next.tags).toEqual([
      'wp',
      'wp:posts',
      'wp:films',
      'wp:post:42',
    ]);
  });

  it('takes a longer window for the callers that need one (the sitemap)', () => {
    expect(wpCache([WP_TAGS.posts], 86400).next.revalidate).toBe(86400);
  });
});

describe('postTag', () => {
  it('is stable across the string and number forms of an id', () => {
    // Route params arrive as strings, WP payloads as numbers; the webhook must
    // not purge a different tag from the one the fetcher wrote.
    expect(postTag('39664')).toBe(postTag(39664));
  });
});

describe('isWpTag', () => {
  it('accepts the namespace and its members', () => {
    expect(isWpTag(WP_TAGS.all)).toBe(true);
    expect(Object.values(WP_TAGS).every(isWpTag)).toBe(true);
    expect(isWpTag(postTag(1))).toBe(true);
  });

  it("rejects Next's implicit route tags, which would purge the whole render cache", () => {
    expect(isWpTag('_N_T_/')).toBe(false);
    expect(isWpTag('_N_T_/news/')).toBe(false);
  });

  it('rejects near-misses rather than treating the prefix as a substring', () => {
    expect(isWpTag('wpposts')).toBe(false);
    expect(isWpTag('not-wp:posts')).toBe(false);
    expect(isWpTag('')).toBe(false);
  });
});
