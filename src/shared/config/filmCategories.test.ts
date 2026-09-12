import { describe, expect, it } from 'vitest';
import { ALL_FILM_CATEGORY_IDS, catalogueHref, FILM_CATEGORIES, resolveFilmCategory } from './filmCategories';

describe('FILM_CATEGORIES', () => {
  it('is keyed by the live site’s URL segments', () => {
    // These segments are the live URLs — /video/multy/ and /video/filmy/ are
    // the #2 and #3 entry pages on the site — so a rename here silently drops
    // that traffic into a 404.
    expect(Object.keys(FILM_CATEGORIES)).toEqual(['filmy', 'multy', 'roliki', 'short', 'famous-people']);
  });

  it('serves «Короткометражные» — the category the nav always pointed at exists now', () => {
    expect(resolveFilmCategory('short')).toBe('short');
  });

  it('exposes every id for the «Все» union', () => {
    expect(ALL_FILM_CATEGORY_IDS).toEqual([581, 580, 86, 671, 559]);
  });
});

describe('resolveFilmCategory', () => {
  it('accepts exactly the catalogue segments', () => {
    expect(resolveFilmCategory('filmy')).toBe('filmy');
    expect(resolveFilmCategory('famous-people')).toBe('famous-people');
  });

  it('rejects anything else, so an unknown segment 404s instead of serving «Все»', () => {
    expect(resolveFilmCategory('nonsense')).toBeNull();
    expect(resolveFilmCategory('')).toBeNull();
    expect(resolveFilmCategory(undefined)).toBeNull();
    expect(resolveFilmCategory(null)).toBeNull();
    // The internal spelling used before the categories became real routes.
    expect(resolveFilmCategory('movies')).toBeNull();
  });

  it('is not fooled by inherited properties', () => {
    // The value comes straight off the URL: `in` or a bare lookup would resolve
    // /video/constructor/ to something off Object.prototype.
    expect(resolveFilmCategory('constructor')).toBeNull();
    expect(resolveFilmCategory('toString')).toBeNull();
  });
});

describe('catalogueHref', () => {
  it('addresses «Все» and each category', () => {
    expect(catalogueHref({ segment: null })).toBe('/video/');
    expect(catalogueHref({ segment: 'filmy' })).toBe('/video/filmy/');
    expect(catalogueHref({ segment: 'famous-people' })).toBe('/video/famous-people/');
  });

  it('paginates with a query param, and page 1 has no second address', () => {
    expect(catalogueHref({ segment: 'multy', page: 2 })).toBe('/video/multy/?page=2');
    expect(catalogueHref({ segment: 'multy', page: 1 })).toBe('/video/multy/');
    expect(catalogueHref({ segment: null, page: 3 })).toBe('/video/?page=3');
  });

  it('carries a topic selection, comma-separated and unencoded', () => {
    expect(catalogueHref({ segment: null, topics: ['alcohol'] })).toBe('/video/?topic=alcohol');
    expect(catalogueHref({ segment: 'multy', topics: ['alcohol', 'tobacco'] })).toBe(
      '/video/multy/?topic=alcohol,tobacco'
    );
    // `URLSearchParams` would write `%2C` here, which is the same URL and a
    // worse one to read or paste.
    expect(catalogueHref({ segment: null, topics: ['alcohol', 'tobacco'] })).not.toContain('%2C');
  });

  it('puts the topics before the page, so one view has one address', () => {
    expect(catalogueHref({ segment: 'filmy', topics: ['alcohol'], page: 2 })).toBe(
      '/video/filmy/?topic=alcohol&page=2'
    );
  });

  it('writes no query at all for the unfiltered first page', () => {
    expect(catalogueHref({ segment: 'filmy', topics: [], page: 1 })).toBe('/video/filmy/');
  });

  it('always terminates the path with a slash', () => {
    // `trailingSlash: true` makes the slashless twin a 301, so linking or
    // canonicalising to one would point at a redirect.
    const paths = [
      catalogueHref({ segment: null }),
      catalogueHref({ segment: 'roliki' }),
      catalogueHref({ segment: 'roliki', page: 4 }),
    ];

    paths.forEach((path) => {
      expect(path.split('?')[0]).toMatch(/\/$/);
    });
  });
});
