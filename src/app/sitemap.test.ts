import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('@/shared/api/httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

import { FILM_CATEGORIES } from '@/shared/config/filmCategories';
import { canonicalUrl, siteUrl } from '@/shared/config/site';
import sitemap from './sitemap';

/** `/`, `/news/`, `/materials/articles/`, `/projects/`, `/video/`, then one per segment. */
const STATIC_COUNT = 5 + Object.keys(FILM_CATEGORIES).length;

const postsPage = (ids: number[], headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(ids.map((id) => ({ id, modified_gmt: '2016-05-19T08:57:08' }))), {
    status: 200,
    headers,
  });

const paginated = (totalPages: number, total: number, ids: (page: number) => number[]) => {
  wpFetch.mockImplementation(async (path: string) => {
    const page = Number(new URL(path, 'https://wp.test').searchParams.get('page') ?? 1);
    return postsPage(ids(page), { 'x-wp-totalpages': String(totalPages), 'x-wp-total': String(total) });
  });
};

afterEach(() => {
  wpFetch.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('sitemap', () => {
  it('lists the static surfaces and every post, all absolute and slash-terminated', async () => {
    paginated(1, 2, () => [71561, 42]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${siteUrl}/`);
    expect(urls).toContain(`${siteUrl}/news/`);
    expect(urls).toContain(`${siteUrl}/materials/articles/`);
    expect(urls).toContain(`${siteUrl}/projects/`);
    expect(urls).toContain(`${siteUrl}/video/`);
    expect(urls).toContain(`${siteUrl}/42/`);
    expect(urls).toContain(`${siteUrl}/71561/`);
    urls.forEach((url) => {
      expect(url.startsWith(`${siteUrl}/`)).toBe(true);
      expect(url.endsWith('/')).toBe(true);
    });
  });

  it('publishes every catalogue segment and never /video/short/', async () => {
    paginated(1, 0, () => []);

    const urls = (await sitemap()).map((entry) => entry.url);

    Object.keys(FILM_CATEGORIES).forEach((segment) => {
      expect(urls).toContain(`${siteUrl}/video/${segment}/`);
    });
    expect(urls).not.toContain(`${siteUrl}/video/short/`);
  });

  it('addresses posts as /<id>/, never /news/<id> or /video/<id>', async () => {
    paginated(1, 1, () => [42]);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).not.toContain(canonicalUrl('/news/42'));
    expect(urls).not.toContain(canonicalUrl('/video/42'));
  });

  it('emits no query URLs — Next does not XML-escape <loc>', async () => {
    paginated(2, 2, (page) => [page]);

    (await sitemap()).forEach((entry) => {
      expect(entry.url).not.toContain('?');
      expect(entry.url).not.toContain('&');
    });
  });

  it('reads modified_gmt as UTC regardless of the container timezone', async () => {
    paginated(1, 1, () => [42]);

    const post = (await sitemap()).find((entry) => entry.url === `${siteUrl}/42/`);

    expect(post?.lastModified).toBeInstanceOf(Date);
    expect((post?.lastModified as Date).toISOString()).toBe('2016-05-19T08:57:08.000Z');
  });

  it('crawls exactly X-WP-TotalPages pages, in ascending id order', async () => {
    paginated(3, 300, (page) => [page * 10, page]);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(wpFetch).toHaveBeenCalledTimes(3);
    const requested = wpFetch.mock.calls.map((call) => new URL(call[0] as string, 'https://wp.test').searchParams);
    expect(requested.map((params) => params.get('page'))).toEqual(['1', '2', '3']);
    requested.forEach((params) => {
      expect(params.get('per_page')).toBe('100');
      expect(params.get('_fields')).toBe('id,modified_gmt');
      expect(params.get('orderby')).toBe('id');
    });
    expect(urls.slice(STATIC_COUNT)).toEqual([1, 2, 3, 10, 20, 30].map((id) => `${siteUrl}/${id}/`));
  });

  it('publishes only the static URLs when WordPress is unconfigured', async () => {
    // The stub client answers 200 with an empty body and no X-WP-* headers —
    // a real outage must not be mistaken for it, and vice versa.
    wpFetch.mockResolvedValue(new Response('[]', { status: 200 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_COUNT);
    expect(entries.map((entry) => entry.url)).toContain(`${siteUrl}/`);
  });

  describe('with a flaky WordPress', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    // The rejection is captured up front: with fake timers the sitemap settles
    // while the clock is being advanced, before an assertion could subscribe.
    const run = async () => {
      let failure: unknown;
      const pending = sitemap().catch((error: unknown) => {
        failure = error;
        return null;
      });
      // Drain the retry backoff (500 ms, then 1000 ms) without real waiting.
      await vi.advanceTimersByTimeAsync(5000);
      const entries = await pending;
      if (failure) {
        throw failure;
      }
      return entries ?? [];
    };

    it('retries a 503 and keeps the page', async () => {
      const attempts = new Map<string, number>();
      wpFetch.mockImplementation(async (path: string) => {
        const page = new URL(path, 'https://wp.test').searchParams.get('page') ?? '1';
        const seen = (attempts.get(page) ?? 0) + 1;
        attempts.set(page, seen);
        if (page === '2' && seen === 1) {
          return new Response('busy', { status: 503 });
        }
        return postsPage([Number(page)], { 'x-wp-totalpages': '2', 'x-wp-total': '2' });
      });

      const urls = (await run()).map((entry) => entry.url);

      expect(attempts.get('2')).toBe(2);
      expect(urls).toContain(`${siteUrl}/2/`);
    });

    it('drops a page that never answers, but says so', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      wpFetch.mockImplementation(async (path: string) => {
        const page = new URL(path, 'https://wp.test').searchParams.get('page') ?? '1';
        if (page === '5') {
          return new Response('busy', { status: 503 });
        }
        return postsPage([Number(page)], { 'x-wp-totalpages': '20', 'x-wp-total': '20' });
      });

      const urls = (await run()).map((entry) => entry.url);

      expect(urls).not.toContain(`${siteUrl}/5/`);
      expect(urls).toContain(`${siteUrl}/6/`);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 of 20 WordPress pages failed'));
    });

    it('refuses to publish when most of the archive is missing', async () => {
      wpFetch.mockImplementation(async (path: string) => {
        const page = new URL(path, 'https://wp.test').searchParams.get('page') ?? '1';
        if (page !== '1') {
          return new Response('busy', { status: 503 });
        }
        return postsPage([1], { 'x-wp-totalpages': '5', 'x-wp-total': '500' });
      });

      await expect(run()).rejects.toThrow(/truncated/);
    });

    it('throws when the first page never answers, so ISR keeps the last good body', async () => {
      wpFetch.mockResolvedValue(new Response('down', { status: 503 }));

      await expect(run()).rejects.toThrow(/first page/);
      expect(wpFetch).toHaveBeenCalledTimes(3);
    });

    it('treats a network error like a 5xx', async () => {
      wpFetch.mockRejectedValue(new Error('ECONNRESET'));

      await expect(run()).rejects.toThrow(/first page/);
      expect(wpFetch).toHaveBeenCalledTimes(3);
    });
  });
});
