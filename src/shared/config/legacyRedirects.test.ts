import { describe, expect, it } from 'vitest';
import { resolveLegacyUrl } from './legacyRedirects';

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

  it('sends «короткометражки» to the full catalogue — no such WP category', () => {
    expect(resolveLegacyUrl('/video/short/')).toBe('/video/');
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
    expect(resolveLegacyUrl('/category/articles/')).toBe('/news/?category=articles');
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
    expect(resolveLegacyUrl('/health/')).toBeNull();
    expect(resolveLegacyUrl('/page/')).toBeNull();
  });

  it('always returns a slash-terminated path, so nothing is left to normalise', () => {
    const destinations = [
      '/video/short/',
      '/video/filmy/page/2/',
      '/news/page/2/',
      '/page/2/',
      '/category/video/mult/',
      '/category/video/movies/page/2/',
      '/category/novosti/',
    ].map((path) => resolveLegacyUrl(path));

    destinations.forEach((destination) => {
      expect(destination).not.toBeNull();
      expect(destination!.split('?')[0]).toMatch(/\/$/);
    });
  });

  it('never lands on a destination that itself redirects', () => {
    const paths = [
      '/video/short/',
      '/video/filmy/page/2/',
      '/news/page/2/',
      '/page/2/',
      '/category/video/mult/',
      '/category/video/movies/page/2/',
      '/category/video/',
      '/category/novosti/',
      '/category/articles/',
    ];

    paths.forEach((path) => {
      const destination = resolveLegacyUrl(path)!;
      expect(resolveLegacyUrl(destination.split('?')[0])).toBeNull();
    });
  });
});
