import { describe, expect, it } from 'vitest';
import { canonicalUrl, fileUrl, siteUrl } from './site';

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
