import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { fetchFeaturedImage } from './fetchFeaturedImage';

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchFeaturedImage', () => {
  it('reads the attachment and resolves its url', async () => {
    wpFetch.mockResolvedValue(new Response(JSON.stringify({ source_url: 'https://wp.test/a.jpg' }), { status: 200 }));

    await expect(fetchFeaturedImage(42, 7)).resolves.toEqual({
      url: 'https://wp.test/a.jpg',
      width: undefined,
      height: undefined,
    });
    // `media_details` whole, never `media_details.width`: WP's nested `_fields`
    // filter cannot descend into it and drops the sub-object silently.
    expect(wpFetch).toHaveBeenCalledWith('/wp/v2/media/42?_fields=source_url,media_details', expect.anything());
    // The post's own tag, so editing the post purges the lookup with it.
    expect(wpFetch.mock.calls[0][1].next.tags).toContain('wp:post:7');
  });

  it('carries the pixel size the card needs', async () => {
    wpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ source_url: 'https://wp.test/a.jpg', media_details: { width: 1280, height: 621 } }),
        { status: 200 }
      )
    );

    await expect(fetchFeaturedImage(42, 7)).resolves.toEqual({
      url: 'https://wp.test/a.jpg',
      width: 1280,
      height: 621,
    });
  });

  it('asks nothing when the post has no featured image', async () => {
    await expect(fetchFeaturedImage(0, 7)).resolves.toBe(null);
    await expect(fetchFeaturedImage(undefined, 7)).resolves.toBe(null);
    expect(wpFetch).not.toHaveBeenCalled();
  });

  it('falls back to null when the attachment is gone', async () => {
    wpFetch.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(fetchFeaturedImage(42, 7)).resolves.toBe(null);
  });
});
