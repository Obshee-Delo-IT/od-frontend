import { describe, expect, it } from 'vitest';
import { resolveLegacySearch, resolveLegacyUrl } from './legacyRedirects';

describe('resolveLegacyUrl', () => {
  it('leaves the catalogue alone — those are served, not redirected', () => {
    // /video/multy/ and /video/filmy/ are the #2 and #3 entry pages on the
    // site. Redirecting them into a ?category= query would hand a crawler a
    // URL it attributes back to /video/.
    expect(resolveLegacyUrl('/video/')).toBeNull();
    expect(resolveLegacyUrl('/video/filmy/')).toBeNull();
    expect(resolveLegacyUrl('/video/multy/')).toBeNull();
    expect(resolveLegacyUrl('/video/roliki/')).toBeNull();
    expect(resolveLegacyUrl('/video/famous-people/')).toBeNull();
  });

  it('serves «Короткометражные» rather than redirecting it — the category is real now', () => {
    expect(resolveLegacyUrl('/video/short/')).toBeNull();
  });

  it('turns WordPress path pagination into the query param we use', () => {
    expect(resolveLegacyUrl('/video/filmy/page/2/')).toBe('/video/filmy/?page=2');
    expect(resolveLegacyUrl('/news/page/2/')).toBe('/news/?page=2');
    expect(resolveLegacyUrl('/page/2/')).toBe('/news/?page=2');
  });

  it('collapses page 1 onto the bare index', () => {
    expect(resolveLegacyUrl('/news/page/1/')).toBe('/news/');
    expect(resolveLegacyUrl('/page/1/')).toBe('/news/');
    expect(resolveLegacyUrl('/video/filmy/page/1/')).toBe('/video/filmy/');
  });

  it('maps the /category/video alias onto the catalogue’s own segments', () => {
    // WordPress spells these differently from the site's pages.
    expect(resolveLegacyUrl('/category/video/movies/')).toBe('/video/filmy/');
    expect(resolveLegacyUrl('/category/video/mult/')).toBe('/video/multy/');
    expect(resolveLegacyUrl('/category/video/roliki/')).toBe('/video/roliki/');
    expect(resolveLegacyUrl('/category/video/famous/')).toBe('/video/famous-people/');
    expect(resolveLegacyUrl('/category/video/')).toBe('/video/');
  });

  it('keeps both the category and the page from a paginated alias', () => {
    expect(resolveLegacyUrl('/category/video/movies/page/2/')).toBe('/video/filmy/?page=2');
    expect(resolveLegacyUrl('/category/video/page/3/')).toBe('/video/?page=3');
  });

  it('degrades an unrecognised alias segment to the full catalogue', () => {
    expect(resolveLegacyUrl('/category/video/nonsense/')).toBe('/video/');
  });

  it('maps the news category aliases to filter keys /news/ actually accepts', () => {
    // The ids (47 / 578) are not filter keys — pointing at them would answer
    // 200 with an unfiltered list, the same silent failure the catalogue had.
    expect(resolveLegacyUrl('/category/novosti/')).toBe('/news/?category=nashi-dela');
  });

  it('sends the «Статьи» archive to the page that collection actually has', () => {
    // Not `/news/?category=articles`: `/materials/articles/` is the live-site
    // URL search engines hold (114 entries in 91 days) and the canonical of the
    // pair, so the WP archive lands on it rather than on its twin.
    expect(resolveLegacyUrl('/category/articles/')).toBe('/materials/articles/');
  });

  it('closes the whole /category/ family — no WP archive is left to 404', () => {
    // `/category/` is WordPress's URL space, not ours. The long tail is ~90
    // regional archives with no equivalent on the redesign; they land on the
    // news index rather than falling through to a 404.
    expect(resolveLegacyUrl('/category/oblast/')).toBe('/news/');
    expect(resolveLegacyUrl('/category/oblast/piter/')).toBe('/news/');
    expect(resolveLegacyUrl('/category/metodic/')).toBe('/news/');
    expect(resolveLegacyUrl('/category/')).toBe('/news/');
    // Cyrillic slugs arrive percent-encoded; unrecognised either way.
    expect(resolveLegacyUrl('/category/%D0%B2%D1%81-%D1%80%D1%84/')).toBe('/news/');
  });

  it('drops the page number from an unmapped archive', () => {
    // Page 20 of «Питер» and page 20 of the whole feed are unrelated sets, so
    // preserving it would drop the visitor mid-feed for no reason.
    expect(resolveLegacyUrl('/category/oblast/piter/page/20/')).toBe('/news/');
  });

  it('never redirects a URL that only existed on our own rebuild', () => {
    // /news/<id> and /video/<id> were this project's first cut of the post
    // routes — never public, never indexed. /<id>/ is served directly, and
    // /video/67400/ falls through to the segment route's 404.
    expect(resolveLegacyUrl('/video/67400/')).toBeNull();
    expect(resolveLegacyUrl('/news/60862/')).toBeNull();
  });

  it('leaves the routes we serve, and everything A6 will serve, alone', () => {
    expect(resolveLegacyUrl('/')).toBeNull();
    expect(resolveLegacyUrl('/news/')).toBeNull();
    expect(resolveLegacyUrl('/67400/')).toBeNull();
    expect(resolveLegacyUrl('/about/')).toBeNull();
    expect(resolveLegacyUrl('/materials/plakati/')).toBeNull();
    expect(resolveLegacyUrl('/materials/articles/')).toBeNull();
    expect(resolveLegacyUrl('/health/')).toBeNull();
    expect(resolveLegacyUrl('/page/')).toBeNull();
  });

  it('always returns a slash-terminated path, so nothing is left to normalise', () => {
    const destinations = [
      '/video/filmy/page/2/',
      '/news/page/2/',
      '/page/2/',
      '/category/video/mult/',
      '/category/video/movies/page/2/',
      '/category/novosti/',
      '/category/articles/',
    ].map((path) => resolveLegacyUrl(path));

    destinations.forEach((destination) => {
      expect(destination).not.toBeNull();
      expect(destination!.split('?')[0]).toMatch(/\/$/);
    });
  });

  it('never lands on a destination that itself redirects', () => {
    const paths = [
      '/video/filmy/page/2/',
      '/news/page/2/',
      '/page/2/',
      '/category/video/mult/',
      '/category/video/movies/page/2/',
      '/category/video/',
      '/category/novosti/',
      '/category/articles/',
      '/category/oblast/piter/',
    ];

    paths.forEach((path) => {
      const destination = resolveLegacyUrl(path)!;
      expect(resolveLegacyUrl(destination.split('?')[0])).toBeNull();
    });
  });
});

describe('resolveLegacySearch', () => {
  it("carries WordPress's search term onto the site's own search page", () => {
    expect(resolveLegacySearch('/', 'алкоголь')).toBe('/search/?q=%D0%B0%D0%BB%D0%BA%D0%BE%D0%B3%D0%BE%D0%BB%D1%8C');
  });

  it('lands on the empty search page when the term is empty', () => {
    expect(resolveLegacySearch('/', '')).toBe('/search/');
    expect(resolveLegacySearch('/', '   ')).toBe('/search/');
  });

  it('leaves the home page alone when there is no `s` at all', () => {
    expect(resolveLegacySearch('/', null)).toBeNull();
  });

  it('is the home page only — `?s=` anywhere else is not a WordPress search URL', () => {
    expect(resolveLegacySearch('/news/', 'алкоголь')).toBeNull();
    expect(resolveLegacySearch('/video/filmy/', 'алкоголь')).toBeNull();
  });

  it('does not send the visitor somewhere that redirects again', () => {
    const destination = resolveLegacySearch('/', 'табак')!;
    expect(resolveLegacyUrl(destination.split('?')[0])).toBeNull();
  });
});
