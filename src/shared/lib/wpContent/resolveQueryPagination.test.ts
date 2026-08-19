import { describe, expect, it } from 'vitest';
import { paginatedPath, resolveQueryPagination } from './resolveQueryPagination';

/**
 * The markup below is verbatim from od-dev — `/wp/v2/pages?slug=smi` — because
 * the bug is entirely in what WordPress writes into those hrefs, and a
 * hand-typed approximation would not carry it: the `&#038;` entities, the
 * `?cst&…` page-1 link `remove_query_arg` leaves behind, and the REST path the
 * next link is built from are all the actual defect.
 */
const NUMBERS_PAGE_1 =
  '<div class="wp-block-query-pagination-numbers">' +
  '<span aria-current="page" class="page-numbers current">1</span>' +
  '<a class="page-numbers" href="?query-95-page=2&#038;slug=smi&#038;_fields=content">2</a>' +
  '<span class="page-numbers dots">&hellip;</span>' +
  '<a class="page-numbers" href="?query-95-page=18&#038;slug=smi&#038;_fields=content">18</a></div>' +
  '<a href="/wp-json/wp/v2/pages?slug=smi&#038;_fields=content&#038;query-95-page=2" ' +
  'class="wp-block-query-pagination-next" aria-label="Следующая страница">' +
  "<span class='wp-block-query-pagination-next-arrow is-arrow-chevron' aria-hidden='true'>»</span></a>";

const NUMBERS_PAGE_2 =
  '<a href="/wp-json/wp/v2/pages?slug=smi&#038;_fields=content&#038;query-95-page=1" ' +
  'class="wp-block-query-pagination-previous" aria-label="Предыдущая страница">«</a>' +
  '<div class="wp-block-query-pagination-numbers">' +
  '<a class="page-numbers" href="?cst&#038;slug=smi&#038;_fields=content">1</a>' +
  '<span aria-current="page" class="page-numbers current">2</span>' +
  '<a class="page-numbers" href="?query-95-page=3&#038;cst&#038;slug=smi&#038;_fields=content">3</a></div>';

const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe('paginatedPath', () => {
  it('leaves page 1 at the page’s own address', () => {
    expect(paginatedPath('/about/smi/', 1)).toBe('/about/smi/');
  });

  it('appends `page/N/` above it', () => {
    expect(paginatedPath('/about/smi/', 2)).toBe('/about/smi/page/2/');
    expect(paginatedPath('/about/reviews/letters/', 11)).toBe('/about/reviews/letters/page/11/');
  });
});

describe('resolveQueryPagination (D3)', () => {
  it('rewrites every pagination link onto this site', () => {
    expect(hrefs(resolveQueryPagination(NUMBERS_PAGE_1, '/about/smi/'))).toEqual([
      '/about/smi/page/2/',
      '/about/smi/page/18/',
      '/about/smi/page/2/',
    ]);
  });

  it('sends both back-links — «previous» and the numbered 1 — to the bare page', () => {
    expect(hrefs(resolveQueryPagination(NUMBERS_PAGE_2, '/about/smi/'))).toEqual([
      '/about/smi/',
      '/about/smi/',
      '/about/smi/page/3/',
    ]);
  });

  /** The whole point: not one link may still address the API. */
  it('leaves no `wp-json` and no `query-N-page` behind', () => {
    const out = resolveQueryPagination(NUMBERS_PAGE_1 + NUMBERS_PAGE_2, '/about/smi/');

    expect(out).not.toContain('wp-json');
    expect(out).not.toContain('query-95-page');
  });

  it('keeps the labels, the chevrons and the current-page span untouched', () => {
    const out = resolveQueryPagination(NUMBERS_PAGE_1, '/about/smi/');

    expect(out).toContain('<span aria-current="page" class="page-numbers current">1</span>');
    expect(out).toContain('is-arrow-chevron');
    expect(out).toContain('aria-label="Следующая страница"');
  });

  it('touches no other link in the body', () => {
    const body = '<p><a href="https://example.com/">внешняя</a> <a class="pager" href="?query-95-page=2">нет</a></p>';

    expect(resolveQueryPagination(body, '/about/smi/')).toBe(body);
  });
});
