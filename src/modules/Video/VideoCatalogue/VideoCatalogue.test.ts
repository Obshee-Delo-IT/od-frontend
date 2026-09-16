import { describe, expect, it } from 'vitest';
import { FILM_CATEGORY_SEGMENTS, type FilmCategorySegment } from '@/shared/config/filmCategories';
import { SITE_NAME, siteUrl } from '@/shared/config/site';
import { catalogueMetadata, cataloguePage, catalogueTopics } from './VideoCatalogue';

const SEGMENTS = FILM_CATEGORY_SEGMENTS;
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
    expect(canonicalOf('short')).toBe(`${siteUrl}/video/short/`);
    expect(canonicalOf('famous-people')).toBe(`${siteUrl}/video/famous-people/`);
  });

  it('self-canonicalises a paginated view instead of pointing it at page 1', () => {
    // Page 2 holds different films; collapsing it onto page 1 would leave
    // everything past the tenth film with no indexable address.
    expect(canonicalOf('filmy', 2)).toBe(`${siteUrl}/video/filmy/?page=2`);
    expect(canonicalOf(null, 3)).toBe(`${siteUrl}/video/?page=3`);
    expect(canonicalOf(null, 1)).toBe(`${siteUrl}/video/`);
  });

  /**
   * All four `/video/filmy/?page=N` URLs used to share one `<title>` — a
   * collision search engines resolve by dropping pages (SEO-10).
   */
  it('numbers a paginated title, the way /news/ does', () => {
    expect(catalogueMetadata('filmy', 1).title).toBe('Фильмы — ОБЩЕЕ ДЕЛО');
    expect(catalogueMetadata('filmy', 3).title).toBe('Фильмы, страница 3 — ОБЩЕЕ ДЕЛО');
    expect(catalogueMetadata('filmy', 3).openGraph?.title).toBe('Фильмы, страница 3 — ОБЩЕЕ ДЕЛО');
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

  it('names the site and the type on every card', () => {
    // A segment's `openGraph` replaces the root layout's whole, so these are
    // emitted only where they are restated — `ogCard` is what restates them,
    // and without it the #2 and #3 entry pages carried no `og:site_name`.
    [null, ...SEGMENTS].forEach((segment) => {
      const card = catalogueMetadata(segment).openGraph;

      expect(card?.siteName).toBe(SITE_NAME);
      expect(card?.locale).toBe('ru_RU');
      expect(card && 'type' in card && card.type).toBe('website');
    });
  });

  it('gives every catalogue page its own social card, image included', () => {
    // Without an `openGraph` of its own each of these inherited the root
    // layout's, so they all unfurled as the same «ОБЩЕЕ ДЕЛО» card.
    const cards = [null, ...SEGMENTS].map((segment) => catalogueMetadata(segment).openGraph);

    expect(new Set(cards.map((card) => card?.title)).size).toBe(cards.length);
    expect(new Set(cards.map((card) => card && 'url' in card && card.url)).size).toBe(cards.length);
    // Distinct images too, not just distinct words: the five shared one card
    // until each segment got its own, and a reader cannot tell «Фильмы» from
    // «Мультфильмы» in a feed by the title alone. «Короткометражные» is the one
    // exception and a deliberate one — the section is newer than the artwork, so
    // it borrows the catalogue's card until a sixth is drawn.
    const drawn = cards.filter((card) => JSON.stringify(card?.images) !== JSON.stringify(cards[0]?.images));
    expect(new Set(drawn.map((card) => JSON.stringify(card?.images))).size).toBe(drawn.length);
    expect(JSON.stringify(catalogueMetadata('short').openGraph?.images)).toBe(
      JSON.stringify(catalogueMetadata(null).openGraph?.images)
    );
  });
});

describe('catalogueTopics', () => {
  it('reads `?topic=` the way the config normalises it', () => {
    expect(catalogueTopics('tobacco,alcohol')).toEqual(['alcohol', 'tobacco']);
    expect(catalogueTopics(undefined)).toEqual([]);
    expect(catalogueTopics('nonsense')).toEqual([]);
  });
});

describe('catalogueMetadata with topics', () => {
  it('keeps a filtered view out of the index, and lets the crawler follow out of it', () => {
    // Ten topics are 1 023 selections over an 84-film catalogue. The films are
    // reached and indexed through the five category pages, which stay indexable.
    expect(catalogueMetadata(null, 1, ['alcohol']).robots).toEqual({ index: false, follow: true });
    expect(catalogueMetadata('multy', 2, ['alcohol', 'tobacco']).robots).toEqual({ index: false, follow: true });
  });

  it('leaves the five unfiltered pages indexable', () => {
    expect(catalogueMetadata(null).robots).toBeUndefined();
    expect(catalogueMetadata('filmy', 3).robots).toBeUndefined();
  });

  it('self-canonicalises rather than pointing at the unfiltered page', () => {
    // Pointing a topic view at `/video/` would claim it holds the same films,
    // which is the thing that is not true about a filter.
    expect(catalogueMetadata(null, 1, ['alcohol']).alternates?.canonical).toBe(`${siteUrl}/video/?topic=alcohol`);
    expect(catalogueMetadata('multy', 2, ['alcohol', 'tobacco']).alternates?.canonical).toBe(
      `${siteUrl}/video/multy/?topic=alcohol,tobacco&page=2`
    );
  });

  it('names the topics in the title, and still ends on the site name', () => {
    const title = catalogueMetadata('multy', 1, ['alcohol', 'tobacco']).title;
    expect(title).toBe('Мультфильмы: Алкоголь, Табак — ОБЩЕЕ ДЕЛО');
    expect(catalogueMetadata(null, 2, ['alcohol']).title).toBe('Видеоматериалы: Алкоголь, страница 2 — ОБЩЕЕ ДЕЛО');
  });

  it('leaves an unfiltered title exactly as it was', () => {
    // The five unfiltered titles are the indexable ones; this path must not
    // start rewriting them on the way through the topic branch.
    expect(catalogueMetadata('multy').title).toBe('Мультфильмы — ОБЩЕЕ ДЕЛО');
    expect(catalogueMetadata('multy', 2).title).toBe('Мультфильмы, страница 2 — ОБЩЕЕ ДЕЛО');
  });
});
