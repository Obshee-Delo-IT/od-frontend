import { describe, expect, it } from 'vitest';
import { catalogueHref, FILM_CATEGORY_SEGMENTS, FILM_CATEGORY_SLUGS, resolveFilmCategory } from './filmCategories';

describe('FILM_CATEGORY_SLUGS', () => {
  it('is keyed by the live site’s URL segments', () => {
    // These segments are the live URLs — /video/multy/ and /video/filmy/ are
    // the #2 and #3 entry pages on the site — so a rename here silently drops
    // that traffic into a 404.
    expect(FILM_CATEGORY_SEGMENTS).toEqual(['filmy', 'multy', 'roliki', 'short', 'famous-people']);
  });

  it('serves «Короткометражные» — the category the nav always pointed at exists now', () => {
    expect(resolveFilmCategory('short')).toBe('short');
  });

  it('holds WordPress slugs, not term ids', () => {
    // Ids are per install — «Короткометражные» is 671 on od-stage and 670 on
    // od-wp — and one build serves every tier, so the id is looked up from the
    // slug at request time (`shared/api/termIds.ts`). A number here is the bug
    // that emptied /video/short/ on the live site (2026-09-16).
    Object.values(FILM_CATEGORY_SLUGS).forEach((slug) => {
      expect(typeof slug).toBe('string');
      expect(slug).toMatch(/^[a-z-]+$/);
    });
  });

  it('keeps the WordPress slug separate from the URL segment', () => {
    // The two differ for three of the five, and the segments are what search
    // traffic lands on — mapping them by hand is the point of this object.
    expect(FILM_CATEGORY_SLUGS.filmy).toBe('movies');
    expect(FILM_CATEGORY_SLUGS.multy).toBe('mult');
    expect(FILM_CATEGORY_SLUGS['famous-people']).toBe('famous');
  });

  it('gives each category its own slug', () => {
    const slugs = Object.values(FILM_CATEGORY_SLUGS);
    expect(new Set(slugs).size).toBe(slugs.length);
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
