import { describe, expect, it } from 'vitest';
import { FILM_CATEGORY_IDS } from './filmCategories';
import { resolveLegacyUrl } from './legacyRedirects';

describe('resolveLegacyUrl', () => {
  it('maps every live catalogue sub-page to the index filter', () => {
    expect(resolveLegacyUrl('/video/filmy/')).toBe('/video/?category=movies');
    expect(resolveLegacyUrl('/video/multy/')).toBe('/video/?category=mult');
    expect(resolveLegacyUrl('/video/roliki/')).toBe('/video/?category=roliki');
    expect(resolveLegacyUrl('/video/famous-people/')).toBe('/video/?category=famous');
    // «короткометражки» has no WP category — the full catalogue is the fallback.
    expect(resolveLegacyUrl('/video/short/')).toBe('/video/');
  });

  it('targets the index by slug, never by category id', () => {
    // `?category=581` is not a miss but a silent fallback to «Все», so it would
    // answer 200 while showing the wrong list. This is the regression guard.
    const ids = Object.values(FILM_CATEGORY_IDS).map(String);
    const paths = [
      '/video/filmy/',
      '/video/multy/',
      '/video/roliki/',
      '/video/famous-people/',
      '/category/video/mult/',
      '/category/video/movies/',
    ];

    paths.forEach((path) => {
      const category = new URL(resolveLegacyUrl(path) ?? '', 'https://x').searchParams.get('category');
      expect(category).not.toBeNull();
      expect(ids).not.toContain(category);
      expect(category! in FILM_CATEGORY_IDS).toBe(true);
    });
  });

  it('folds the redesigned detail URLs into the canonical /<id>', () => {
    expect(resolveLegacyUrl('/video/67400/')).toBe('/67400/');
    expect(resolveLegacyUrl('/news/60862/')).toBe('/60862/');
  });

  it('handles the /category/video alias, including its own segments', () => {
    expect(resolveLegacyUrl('/category/video/mult/')).toBe('/video/?category=mult');
    expect(resolveLegacyUrl('/category/video/movies/')).toBe('/video/?category=movies');
    expect(resolveLegacyUrl('/category/video/roliki/')).toBe('/video/?category=roliki');
    expect(resolveLegacyUrl('/category/video/famous/')).toBe('/video/?category=famous');
    expect(resolveLegacyUrl('/category/video/')).toBe('/video/');
    // An unrecognised segment degrades to the full catalogue rather than 404ing.
    expect(resolveLegacyUrl('/category/video/nonsense/')).toBe('/video/');
  });

  it('keeps both the category and the page when the alias carries pagination', () => {
    expect(resolveLegacyUrl('/category/video/movies/page/2/')).toBe('/video/?category=movies&page=2');
    expect(resolveLegacyUrl('/category/video/page/3/')).toBe('/video/?page=3');
  });

  it('rewrites path pagination to the query param we use', () => {
    expect(resolveLegacyUrl('/news/page/2/')).toBe('/news/?page=2');
    expect(resolveLegacyUrl('/page/2/')).toBe('/news/?page=2');
    // Page 1 is the bare index — no redundant `?page=1` in the destination.
    expect(resolveLegacyUrl('/news/page/1/')).toBe('/news/');
    expect(resolveLegacyUrl('/page/1/')).toBe('/');
  });

  it('always returns a slash-terminated path, so nothing is left to normalise', () => {
    const destinations = [
      '/video/filmy/',
      '/video/67400/',
      '/news/60862/',
      '/news/page/2/',
      '/page/2/',
      '/category/video/mult/',
      '/category/novosti/',
    ].map((path) => resolveLegacyUrl(path));

    destinations.forEach((destination) => {
      expect(destination).not.toBeNull();
      expect(destination!.split('?')[0]).toMatch(/\/$/);
    });
  });

  it('leaves the routes we actually serve alone', () => {
    expect(resolveLegacyUrl('/')).toBeNull();
    expect(resolveLegacyUrl('/video/')).toBeNull();
    expect(resolveLegacyUrl('/news/')).toBeNull();
    expect(resolveLegacyUrl('/67400/')).toBeNull();
    expect(resolveLegacyUrl('/about/')).toBeNull();
    expect(resolveLegacyUrl('/materials/plakati/')).toBeNull();
    expect(resolveLegacyUrl('/health/')).toBeNull();
  });

  it('maps the two news category aliases', () => {
    expect(resolveLegacyUrl('/category/novosti/')).toBe('/news/?category=47');
    expect(resolveLegacyUrl('/category/articles/')).toBe('/news/?category=578');
  });
});
