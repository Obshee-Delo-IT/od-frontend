import { describe, expect, it } from 'vitest';
import { resolveLegacyUrl } from './legacyRedirects';
import { ARTICLES_HREF, NEWS_CATEGORIES, resolveNewsCategory } from './newsCategories';

describe('resolveNewsCategory', () => {
  it('accepts the two filter keys the chips expose', () => {
    expect(resolveNewsCategory('nashi-dela')).toBe('nashi-dela');
    expect(resolveNewsCategory('articles')).toBe('articles');
  });

  it('degrades anything else to «Все» rather than erroring', () => {
    expect(resolveNewsCategory(undefined)).toBeNull();
    expect(resolveNewsCategory('')).toBeNull();
    expect(resolveNewsCategory('nonsense')).toBeNull();
  });

  it('rejects a WP id, which is what makes the 200-with-unfiltered-content bug loud', () => {
    // `?category=578` looks like it works — it answers 200 — but shows every
    // post. Resolving it to null is what lets the canonical say «Все» honestly.
    expect(resolveNewsCategory('578')).toBeNull();
    expect(resolveNewsCategory('47')).toBeNull();
  });

  it('does not resolve inherited Object properties off a query string', () => {
    expect(resolveNewsCategory('constructor')).toBeNull();
    expect(resolveNewsCategory('toString')).toBeNull();
  });
});

describe('ARTICLES_HREF', () => {
  it('is slash-terminated, so trailingSlash has nothing left to normalise', () => {
    expect(ARTICLES_HREF).toMatch(/\/$/);
  });

  it('is a served route, not one the proxy would redirect away', () => {
    expect(resolveLegacyUrl(ARTICLES_HREF)).toBeNull();
  });
});

describe('NEWS_CATEGORIES', () => {
  it('holds the ids the /news/ filters and the articles alias both read', () => {
    expect(NEWS_CATEGORIES.articles).toBe(578);
    expect(NEWS_CATEGORIES['nashi-dela']).toBe(47);
  });
});
