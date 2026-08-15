import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

import { fetchWpPage } from './fetchWpPage';

const makeResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const page = (over: Record<string, unknown> = {}) => ({
  id: 60050,
  link: 'https://wp.test/healthy-russia/',
  title: { rendered: 'Здоровая&nbsp;Россия<br>2021' },
  content: { rendered: '<div class="wp-block-group">тело</div>' },
  excerpt: { rendered: '<p>Программа</p>' },
  ...over,
});

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchWpPage', () => {
  it('queries by the last segment and maps the page', async () => {
    wpFetch.mockResolvedValue(makeResponse([page()]));

    const result = await fetchWpPage('/healthy-russia/');

    expect(wpFetch.mock.calls[0][0]).toContain('/wp/v2/pages?slug=healthy-russia');
    expect(result).toEqual({
      id: 60050,
      title: 'Здоровая Россия 2021',
      contentHtml: '<div class="wp-block-group">тело</div>',
      description: 'Программа',
    });
  });

  /**
   * The reason the fetcher looks at `link` at all: WP's `?slug=` matches the
   * last segment anywhere in the tree, so a child page can answer for a
   * top-level path it has nothing to do with.
   */
  it('rejects a same-slug page that lives under another parent', async () => {
    wpFetch.mockResolvedValue(makeResponse([page({ link: 'https://wp.test/materials/healthy-russia/' })]));

    await expect(fetchWpPage('/healthy-russia/')).resolves.toBeNull();
  });

  it('picks the matching page out of several same-slug hits', async () => {
    wpFetch.mockResolvedValue(
      makeResponse([
        page({ id: 1, link: 'https://wp.test/materials/plakati/' }),
        page({ id: 2, link: 'https://wp.test/plakati/' }),
      ])
    );

    await expect(fetchWpPage('/plakati/')).resolves.toMatchObject({ id: 2 });
  });

  it('matches a percent-encoded permalink against the decoded path', async () => {
    wpFetch.mockResolvedValue(makeResponse([page({ link: 'https://wp.test/%D1%82%D0%B5%D1%81%D1%82/' })]));

    await expect(fetchWpPage('/тест/')).resolves.toMatchObject({ id: 60050 });
  });

  it.each([
    ['an empty result', [] as unknown],
    ['a non-array body', null as unknown],
  ])('returns null for %s', async (_label, body) => {
    wpFetch.mockResolvedValue(makeResponse(body));

    await expect(fetchWpPage('/healthy-russia/')).resolves.toBeNull();
  });

  it('returns null on an upstream error rather than throwing', async () => {
    wpFetch.mockResolvedValue(makeResponse({ code: 'boom' }, 500));

    await expect(fetchWpPage('/healthy-russia/')).resolves.toBeNull();
  });

  it('asks nothing for a pathless path', async () => {
    await expect(fetchWpPage('/')).resolves.toBeNull();
    expect(wpFetch).not.toHaveBeenCalled();
  });
});
