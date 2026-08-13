import { describe, expect, it } from 'vitest';
import { FILM_CATEGORY_IDS, LEGACY_FILM_SEGMENTS } from './filmCategories';
import { legacyRedirects } from './legacyRedirects';

const rules = legacyRedirects();
const find = (source: string) => rules.find((rule) => rule.source === source);

describe('legacyRedirects', () => {
  it('maps every live catalogue sub-page to the index filter', () => {
    expect(find('/video/filmy')?.destination).toBe('/video?category=movies');
    expect(find('/video/multy')?.destination).toBe('/video?category=mult');
    expect(find('/video/roliki')?.destination).toBe('/video?category=roliki');
    expect(find('/video/famous-people')?.destination).toBe('/video?category=famous');
    // «короткометражки» has no WP category — the full catalogue is the fallback.
    expect(find('/video/short')?.destination).toBe('/video');
  });

  it('targets the index by slug, not by category id', () => {
    // `?category=581` silently falls back to «Все» — the index looks the param
    // up in FILM_CATEGORY_IDS by key. This is the bug the rules must not have.
    const ids = Object.values(FILM_CATEGORY_IDS).map(String);
    const targeted = rules
      .map((rule) => new URL(rule.destination, 'https://x').searchParams.get('category'))
      .filter((category): category is string => category !== null);

    expect(targeted.length).toBeGreaterThan(0);
    targeted.forEach((category) => expect(ids).not.toContain(category));
  });

  it('only emits category slugs the index recognises', () => {
    Object.values(LEGACY_FILM_SEGMENTS).forEach((slug) => expect(slug in FILM_CATEGORY_IDS).toBe(true));
  });

  it('folds the redesigned detail URLs into the canonical /<id>', () => {
    expect(find('/news/:id(\\d+)')?.destination).toBe('/:id');
    expect(find('/video/:id(\\d+)')?.destination).toBe('/:id');
  });

  it('rewrites path pagination to the query param we use', () => {
    expect(find('/news/page/:page(\\d+)')?.destination).toBe('/news?page=:page');
    expect(find('/page/:page(\\d+)')?.destination).toBe('/news?page=:page');
  });

  it('matches /category/video/:segment/page/N before the bare :segment rule', () => {
    const paged = rules.findIndex((rule) => rule.source === '/category/video/:segment/page/:page(\\d+)');
    const bare = rules.findIndex((rule) => rule.source === '/category/video/:segment');

    expect(paged).toBeGreaterThanOrEqual(0);
    expect(paged).toBeLessThan(bare);
  });

  it('is permanent throughout — these URLs are never coming back', () => {
    rules.forEach((rule) => expect(rule.permanent).toBe(true));
  });

  it('has no duplicate sources, which would make the later rule dead', () => {
    const sources = rules.map((rule) => rule.source);

    expect(new Set(sources).size).toBe(sources.length);
  });
});
