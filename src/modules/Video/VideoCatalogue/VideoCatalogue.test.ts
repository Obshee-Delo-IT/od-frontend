import { describe, expect, it } from 'vitest';
import { FILM_CATEGORIES, type FilmCategorySegment } from '@/shared/config/filmCategories';
import { siteUrl } from '@/shared/config/site';
import { catalogueMetadata, cataloguePage } from './VideoCatalogue';

const SEGMENTS = Object.keys(FILM_CATEGORIES) as FilmCategorySegment[];
const canonicalOf = (segment: FilmCategorySegment | null, page?: number) =>
  catalogueMetadata(segment, page).alternates?.canonical;

describe('cataloguePage', () => {
  it('reads a page past the first, and nothing else', () => {
    expect(cataloguePage('2')).toBe(2);
    expect(cataloguePage(['3', '9'])).toBe(3);
    expect(cataloguePage('1')).toBe(1);
    expect(cataloguePage(undefined)).toBe(1);
    expect(cataloguePage('')).toBe(1);
    expect(cataloguePage('nonsense')).toBe(1);
    expect(cataloguePage('-4')).toBe(1);
    expect(cataloguePage('2.9')).toBe(2);
  });
});

describe('catalogueMetadata', () => {
  it('canonicalises each category to its own page', () => {
    expect(canonicalOf(null)).toBe(`${siteUrl}/video/`);
    expect(canonicalOf('filmy')).toBe(`${siteUrl}/video/filmy/`);
    expect(canonicalOf('multy')).toBe(`${siteUrl}/video/multy/`);
    expect(canonicalOf('roliki')).toBe(`${siteUrl}/video/roliki/`);
    expect(canonicalOf('famous-people')).toBe(`${siteUrl}/video/famous-people/`);
  });

  it('self-canonicalises a paginated view instead of pointing it at page 1', () => {
    // Page 2 holds different films; collapsing it onto page 1 would leave
    // everything past the tenth film with no indexable address.
    expect(canonicalOf('filmy', 2)).toBe(`${siteUrl}/video/filmy/?page=2`);
    expect(canonicalOf(null, 3)).toBe(`${siteUrl}/video/?page=3`);
    expect(canonicalOf(null, 1)).toBe(`${siteUrl}/video/`);
  });

  it('gives every catalogue page its own title and description', () => {
    const pages = [null, ...SEGMENTS].map((segment) => catalogueMetadata(segment));
    const titles = pages.map((page) => page.title);
    const descriptions = pages.map((page) => page.description);

    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
    titles.forEach((title) => {
      expect(title).toMatch(/ОБЩЕЕ ДЕЛО$/);
    });
  });

  it('gives every catalogue page its own social card, image included', () => {
    // Without an `openGraph` of its own each of these five inherited the root
    // layout's, so all five unfurled as the same «ОБЩЕЕ ДЕЛО» card.
    const cards = [null, ...SEGMENTS].map((segment) => catalogueMetadata(segment).openGraph);

    expect(new Set(cards.map((card) => card?.title)).size).toBe(cards.length);
    expect(new Set(cards.map((card) => card && 'url' in card && card.url)).size).toBe(cards.length);
    cards.forEach((card) => {
      expect(card?.images).toBeDefined();
    });
  });
});
