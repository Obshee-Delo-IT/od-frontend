import { describe, expect, it } from 'vitest';
import { canonicalUrl, fileUrl, resolveCanonicalRedirect, siteUrl } from './site';

describe('canonicalUrl', () => {
  it('defaults to the site root, slash included', () => {
    expect(canonicalUrl()).toBe(`${siteUrl}/`);
    expect(canonicalUrl('/')).toBe(`${siteUrl}/`);
    expect(canonicalUrl('')).toBe(`${siteUrl}/`);
  });

  it('appends the trailing slash exactly once', () => {
    expect(canonicalUrl('/news')).toBe(`${siteUrl}/news/`);
    expect(canonicalUrl('/news/')).toBe(`${siteUrl}/news/`);
    expect(canonicalUrl('news')).toBe(`${siteUrl}/news/`);
  });

  it('collapses empty segments', () => {
    expect(canonicalUrl('//video//filmy//')).toBe(`${siteUrl}/video/filmy/`);
  });

  it('slashes the pathname and keeps the query after it', () => {
    expect(canonicalUrl('/news?page=2')).toBe(`${siteUrl}/news/?page=2`);
    expect(canonicalUrl('/news/?page=2')).toBe(`${siteUrl}/news/?page=2`);
    expect(canonicalUrl('/news?category=articles&page=2')).toBe(`${siteUrl}/news/?category=articles&page=2`);
  });

  it('keeps the root slash when only a query is given', () => {
    expect(canonicalUrl('?page=2')).toBe(`${siteUrl}/?page=2`);
  });

  it('builds post URLs in the legacy /<id>/ form', () => {
    expect(canonicalUrl('/71561')).toBe(`${siteUrl}/71561/`);
  });

  it('never advertises a URL that trailingSlash would redirect', () => {
    const paths = ['/', '/news', '/video/filmy', '/71561', '/news?page=3'];
    paths.forEach((path) => {
      const url = canonicalUrl(path);
      expect(url.startsWith(`${siteUrl}/`)).toBe(true);
      expect(url.split('?')[0].endsWith('/')).toBe(true);
    });
  });
});

describe('fileUrl', () => {
  it('leaves dotted files slashless — the slashed twin is the one that 308s', () => {
    expect(fileUrl('/sitemap.xml')).toBe(`${siteUrl}/sitemap.xml`);
    expect(fileUrl('sitemap.xml')).toBe(`${siteUrl}/sitemap.xml`);
    expect(fileUrl('//robots.txt')).toBe(`${siteUrl}/robots.txt`);
  });
});

describe('resolveCanonicalRedirect', () => {
  const APEX = 'obshee-delo.ru';
  const RF_HYPHEN = 'xn----9sbkcac6brh7h.xn--p1ai'; // общее-дело.рф
  const RF_PLAIN = 'xn--90agcab0bpg7g.xn--p1ai'; // общеедело.рф

  it('leaves the canonical host alone', () => {
    expect(resolveCanonicalRedirect(APEX, '/news/')).toBeNull();
  });

  it('folds every alias onto the canonical host, path and query intact', () => {
    for (const host of [`www.${APEX}`, RF_HYPHEN, `www.${RF_HYPHEN}`, RF_PLAIN, `www.${RF_PLAIN}`]) {
      expect(resolveCanonicalRedirect(host, '/materials/plakati/')).toBe(`${siteUrl}/materials/plakati/`);
      expect(resolveCanonicalRedirect(host, '/news/?category=articles')).toBe(`${siteUrl}/news/?category=articles`);
    }
  });

  /**
   * The reason this is an allowlist. Coolify polls the container on
   * `localhost:3000` and reads anything but a 200 as a failure, so a rule that
   * redirected every non-canonical host would restart-loop the application.
   */
  it('never touches the health check, the fallback host or a preview host', () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', 'prod.obshee-delo.ru', 'new.obshee-delo.ru']) {
      expect(resolveCanonicalRedirect(host, '/health/')).toBeNull();
    }
  });

  it('ignores the port and the case of the host', () => {
    expect(resolveCanonicalRedirect(`WWW.${APEX.toUpperCase()}:443`, '/')).toBe(`${siteUrl}/`);
  });

  it('answers null when there is no host at all', () => {
    expect(resolveCanonicalRedirect(null, '/')).toBeNull();
    expect(resolveCanonicalRedirect(undefined, '/')).toBeNull();
    expect(resolveCanonicalRedirect('', '/')).toBeNull();
  });

  /**
   * `помощь.общее-дело.рф` takes donations and `xn--80a7adb.…` is the statistics
   * site — both are other people's services on a domain we happen to share.
   */
  it('leaves the sibling subdomains external', () => {
    expect(resolveCanonicalRedirect(`xn--d1aadek5agm.${RF_HYPHEN}`, '/')).toBeNull();
    expect(resolveCanonicalRedirect(`xn--80a7adb.${RF_HYPHEN}`, '/')).toBeNull();
  });
});
