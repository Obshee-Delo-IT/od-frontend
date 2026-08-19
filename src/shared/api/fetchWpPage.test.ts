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
      ancestors: [],
    });
  });

  /**
   * The breadcrumb the sub-page mocks draw. One request per level, outermost
   * first, so `/materials/printed-products/` reads «Материалы → Печатная
   * продукция» rather than starting at the page itself.
   */
  it('walks the parent chain into a breadcrumb trail', async () => {
    wpFetch
      .mockResolvedValueOnce(
        makeResponse([page({ link: 'https://wp.test/materials/printed-products/', parent: 20225 })])
      )
      .mockResolvedValueOnce(
        makeResponse({ link: 'https://wp.test/materials/', parent: 0, title: { rendered: 'Материалы' } })
      );

    const result = await fetchWpPage('/materials/printed-products/');

    expect(result?.ancestors).toEqual([{ title: 'Материалы', href: '/materials/' }]);
  });

  it('stops the trail where a level fails rather than failing the page', async () => {
    wpFetch
      .mockResolvedValueOnce(makeResponse([page({ link: 'https://wp.test/materials/plakati/', parent: 20225 })]))
      .mockResolvedValueOnce(makeResponse({ code: 'boom' }, 500));

    await expect(fetchWpPage('/materials/plakati/')).resolves.toMatchObject({ ancestors: [] });
  });

  /** Depth is capped: each level is a request on a route that must stay static. */
  it('climbs no more than three levels', async () => {
    wpFetch.mockResolvedValueOnce(makeResponse([page({ link: 'https://wp.test/a/b/c/d/e/', parent: 2 })]));
    for (let i = 0; i < 6; i += 1) {
      wpFetch.mockResolvedValueOnce(
        makeResponse({ link: `https://wp.test/level-${i}/`, parent: 3, title: { rendered: `L${i}` } })
      );
    }

    const result = await fetchWpPage('/a/b/c/d/e/');

    expect(result?.ancestors).toHaveLength(3);
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

/**
 * D3 — a later page of the body's `core/query` block. The parameter's id is the
 * editor's (`query-95-page` here, `query-100-page` on
 * `/about/reviews/letters/`), so it is read out of the page-1 body rather than
 * assumed.
 */
describe('fetchWpPage, paginated', () => {
  const paginated = (n: number) =>
    page({
      link: 'https://wp.test/about/smi/',
      content: {
        rendered:
          `<ul class="wp-block-post-template"><li>страница ${n}</li></ul>` +
          '<a class="page-numbers" href="?query-95-page=2&#038;slug=smi">2</a>',
      },
    });

  it('asks for page 1 only, and once, when no page is requested', async () => {
    wpFetch.mockResolvedValue(makeResponse([paginated(1)]));

    await fetchWpPage('/about/smi/');

    expect(wpFetch).toHaveBeenCalledTimes(1);
    expect(wpFetch.mock.calls[0][0]).not.toContain('query-95-page');
  });

  it('reads the query id off page 1 and asks for the page under it', async () => {
    wpFetch.mockResolvedValueOnce(makeResponse([paginated(1)])).mockResolvedValueOnce(makeResponse([paginated(2)]));

    const result = await fetchWpPage('/about/smi/', 2);

    expect(wpFetch.mock.calls[1][0]).toContain('&query-95-page=2');
    expect(result?.contentHtml).toContain('страница 2');
  });

  /** The title, the description and the trail are the page's, not the page-of-posts'. */
  it('keeps everything but the body from page 1', async () => {
    wpFetch.mockResolvedValueOnce(makeResponse([paginated(1)])).mockResolvedValueOnce(
      makeResponse([
        page({
          link: 'https://wp.test/about/smi/',
          title: { rendered: 'подменённый' },
          excerpt: { rendered: '<p>подменённое</p>' },
          content: { rendered: '<ul class="wp-block-post-template"><li>страница 2</li></ul>' },
        }),
      ])
    );

    await expect(fetchWpPage('/about/smi/', 2)).resolves.toMatchObject({
      title: 'Здоровая Россия 2021',
      description: 'Программа',
    });
  });

  /** Past the last page core renders no `post-template` at all — that is the 404 signal. */
  it('returns null past the last page rather than an empty list', async () => {
    wpFetch
      .mockResolvedValueOnce(makeResponse([paginated(1)]))
      .mockResolvedValueOnce(
        makeResponse([page({ link: 'https://wp.test/about/smi/', content: { rendered: '<div></div>' } })])
      );

    await expect(fetchWpPage('/about/smi/', 19)).resolves.toBeNull();
  });

  it('returns null, without a second request, for a page that has no query block', async () => {
    wpFetch.mockResolvedValue(makeResponse([page({ link: 'https://wp.test/about/ustav/' })]));

    await expect(fetchWpPage('/about/ustav/', 2)).resolves.toBeNull();
    expect(wpFetch).toHaveBeenCalledTimes(1);
  });
});
